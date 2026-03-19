import re, os

path = 'app/page.tsx'
if not os.path.exists(path):
    print("ERROR: Run this from your crypto/ folder")
    exit(1)

with open(path, 'r') as f:
    c = f.read()

# Find and remove the alert() — replace entire selectPlan body
pattern = r"(function selectPlan\(plan: 'weekly' \| 'yearly'\) \{)[^}]*(})"
new_body = """async function selectPlan(plan: 'weekly' | 'yearly') {
    const links = {
      weekly: 'https://buy.stripe.com/test_fZu00i6TA2MZ2dab9q3Je01',
      yearly: 'https://buy.stripe.com/test_8x214m7XE73fdVS6Ta3Je00',
    }
    window.open(links[plan], '_blank')
  }"""

result, count = re.subn(
    r"function selectPlan\(plan: 'weekly' \| 'yearly'\) \{.*?\n  \}",
    new_body,
    c,
    flags=re.DOTALL
)

if count > 0:
    with open(path, 'w') as f:
        f.write(result)
    print("FIXED - selectPlan now opens Stripe link, no alert()")
    print("Run: rm -rf .next && npm run dev")
else:
    print("NOT FOUND - already patched")
    print("Run: rm -rf .next && npm run dev")
