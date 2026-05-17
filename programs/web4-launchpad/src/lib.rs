use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer};

declare_id!("DjGTVwckj7649JhWomSaC89vTrD4abrvSpejFQS2armL");

const VIRTUAL_SOL: u64 = 30_000_000_000;
const VIRTUAL_TOKEN: u64 = 1_073_000_191_000_000;
const GRADUATION_LAMPORTS: u64 = 85_000_000_000;
const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000;
const FEE_BPS: u64 = 100;
const BPS: u64 = 10_000;

#[program]
pub mod web4_launchpad {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        name: String,
        symbol: String,
        uri: String,
        _initial_buy_lamports: u64,
    ) -> Result<()> {
        require!(name.len() <= 32, Web4Error::NameTooLong);
        require!(symbol.len() <= 10, Web4Error::SymbolTooLong);
        require!(uri.len() <= 200, Web4Error::UriTooLong);

        let pool = &mut ctx.accounts.pool;
        pool.mint = ctx.accounts.mint.key();
        pool.virtual_sol_reserves = VIRTUAL_SOL;
        pool.virtual_token_reserves = VIRTUAL_TOKEN;
        pool.real_sol_reserves = 0;
        pool.tokens_sold = 0;
        pool.graduated = false;
        pool.bump = ctx.bumps.pool;
        pool.vault_bump = ctx.bumps.vault_authority;
        pool.name = name;
        pool.symbol = symbol;

        let signer_seeds: &[&[u8]] = &[
            b"vault_authority",
            ctx.accounts.mint.key().as_ref(),
            &[pool.vault_bump],
        ];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            TOTAL_SUPPLY,
        )?;

        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: ctx.accounts.vault_authority.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
                &[signer_seeds],
            ),
            anchor_spl::token::spl_token::instruction::AuthorityType::MintTokens,
            None,
        )?;

        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: ctx.accounts.vault_authority.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
                &[signer_seeds],
            ),
            anchor_spl::token::spl_token::instruction::AuthorityType::FreezeAccount,
            None,
        )?;

        emit!(PoolCreated {
            mint: pool.mint,
            symbol: pool.symbol.clone(),
            uri,
        });

        Ok(())
    }

    pub fn buy(ctx: Context<Trade>, lamports_in: u64, min_tokens_out: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(!pool.graduated, Web4Error::AlreadyGraduated);
        execute_buy(
            pool,
            &ctx.accounts.pool.to_account_info(),
            &ctx.accounts.user,
            &ctx.accounts.user_token_account,
            &ctx.accounts.token_vault,
            &ctx.accounts.vault_authority,
            &ctx.accounts.token_program,
            &ctx.accounts.system_program,
            lamports_in,
            min_tokens_out,
        )
    }

    pub fn sell(ctx: Context<Trade>, tokens_in: u64, min_lamports_out: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(!pool.graduated, Web4Error::AlreadyGraduated);
        require!(tokens_in > 0, Web4Error::ZeroAmount);

        let k = (pool.virtual_sol_reserves as u128) * (pool.virtual_token_reserves as u128);
        let new_virtual_token = pool
            .virtual_token_reserves
            .checked_add(tokens_in)
            .ok_or(Web4Error::MathOverflow)?;
        let new_virtual_sol = (k / new_virtual_token as u128) as u64;
        let gross_sol = pool
            .virtual_sol_reserves
            .checked_sub(new_virtual_sol)
            .ok_or(Web4Error::MathOverflow)?;
        let fee = gross_sol.checked_mul(FEE_BPS).ok_or(Web4Error::MathOverflow)? / BPS;
        let sol_out = gross_sol.checked_sub(fee).ok_or(Web4Error::MathOverflow)?;
        require!(sol_out >= min_lamports_out, Web4Error::Slippage);

        pool.virtual_token_reserves = new_virtual_token;
        pool.virtual_sol_reserves = new_virtual_sol;
        pool.tokens_sold = pool.tokens_sold.saturating_sub(tokens_in);
        if pool.real_sol_reserves > sol_out {
            pool.real_sol_reserves -= sol_out;
        } else {
            pool.real_sol_reserves = 0;
        }

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            tokens_in,
        )?;

        **ctx.accounts.pool.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .pool
            .to_account_info()
            .lamports()
            .checked_sub(sol_out)
            .ok_or(Web4Error::MathOverflow)?;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .user
            .to_account_info()
            .lamports()
            .checked_add(sol_out)
            .ok_or(Web4Error::MathOverflow)?;

        emit!(TradeEvent {
            mint: pool.mint,
            side: 1,
            amount_in: tokens_in,
            amount_out: sol_out,
        });

        Ok(())
    }

    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(!pool.graduated, Web4Error::AlreadyGraduated);
        require!(
            pool.real_sol_reserves >= GRADUATION_LAMPORTS,
            Web4Error::NotReadyToGraduate
        );
        pool.graduated = true;
        emit!(GraduatedEvent {
            mint: pool.mint,
            real_sol: pool.real_sol_reserves,
        });
        Ok(())
    }
}

fn execute_buy<'info>(
    pool: &mut Account<'info, Pool>,
    pool_info: &AccountInfo<'info>,
    user: &Signer<'info>,
    user_token_account: &Account<'info, TokenAccount>,
    token_vault: &Account<'info, TokenAccount>,
    vault_authority: &AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    system_program: &Program<'info, System>,
    lamports_in: u64,
    min_tokens_out: u64,
) -> Result<()> {
    require!(lamports_in > 0, Web4Error::ZeroAmount);
    let fee = lamports_in
        .checked_mul(FEE_BPS)
        .ok_or(Web4Error::MathOverflow)?
        / BPS;
    let net_sol = lamports_in.checked_sub(fee).ok_or(Web4Error::MathOverflow)?;

    let k = (pool.virtual_sol_reserves as u128) * (pool.virtual_token_reserves as u128);
    let new_virtual_sol = pool
        .virtual_sol_reserves
        .checked_add(net_sol)
        .ok_or(Web4Error::MathOverflow)?;
    let new_virtual_token = (k / new_virtual_sol as u128) as u64;
    let tokens_out = pool
        .virtual_token_reserves
        .checked_sub(new_virtual_token)
        .ok_or(Web4Error::MathOverflow)?;
    require!(tokens_out >= min_tokens_out, Web4Error::Slippage);

    pool.virtual_sol_reserves = new_virtual_sol;
    pool.virtual_token_reserves = new_virtual_token;
    pool.tokens_sold = pool
        .tokens_sold
        .checked_add(tokens_out)
        .ok_or(Web4Error::MathOverflow)?;
    pool.real_sol_reserves = pool
        .real_sol_reserves
        .checked_add(net_sol)
        .ok_or(Web4Error::MathOverflow)?
        .min(GRADUATION_LAMPORTS);

    if pool.real_sol_reserves >= GRADUATION_LAMPORTS {
        pool.graduated = true;
    }

    system_program::transfer(
        CpiContext::new(
            system_program.to_account_info(),
            system_program::Transfer {
                from: user.to_account_info(),
                to: pool_info.to_account_info(),
            },
        ),
        lamports_in,
    )?;

    let signer_seeds: &[&[u8]] = &[b"vault_authority", pool.mint.as_ref(), &[pool.vault_bump]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: token_vault.to_account_info(),
                to: user_token_account.to_account_info(),
                authority: vault_authority.to_account_info(),
            },
            &[signer_seeds],
        ),
        tokens_out,
    )?;

    emit!(TradeEvent {
        mint: pool.mint,
        side: 0,
        amount_in: lamports_in,
        amount_out: tokens_out,
    });

    Ok(())
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub mint: Pubkey,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub tokens_sold: u64,
    pub graduated: bool,
    pub bump: u8,
    pub vault_bump: u8,
    #[max_len(32)]
    pub name: String,
    #[max_len(10)]
    pub symbol: String,
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = vault_authority,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    /// CHECK: PDA signer for vault
    #[account(seeds = [b"vault_authority", mint.key().as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"pool", mint.key().as_ref()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = vault_authority)]
    pub token_vault: Account<'info, TokenAccount>,
    /// CHECK: vault PDA
    #[account(seeds = [b"vault_authority", mint.key().as_ref()], bump = pool.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"pool", mint.key().as_ref()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = vault_authority)]
    pub token_vault: Account<'info, TokenAccount>,
    /// CHECK: vault PDA
    #[account(seeds = [b"vault_authority", mint.key().as_ref()], bump = pool.vault_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct PoolCreated {
    pub mint: Pubkey,
    pub symbol: String,
    pub uri: String,
}

#[event]
pub struct TradeEvent {
    pub mint: Pubkey,
    pub side: u8,
    pub amount_in: u64,
    pub amount_out: u64,
}

#[event]
pub struct GraduatedEvent {
    pub mint: Pubkey,
    pub real_sol: u64,
}

#[error_code]
pub enum Web4Error {
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Symbol too long")]
    SymbolTooLong,
    #[msg("URI too long")]
    UriTooLong,
    #[msg("Already graduated")]
    AlreadyGraduated,
    #[msg("Not ready to graduate")]
    NotReadyToGraduate,
    #[msg("Slippage exceeded")]
    Slippage,
    #[msg("Zero amount")]
    ZeroAmount,
    #[msg("Math overflow")]
    MathOverflow,
}
