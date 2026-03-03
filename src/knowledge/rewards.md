# Reward System

## Monthly Reward Pool

The TeaFi Program distributes a monthly reward pool among eligible participants. The default pool size is **$2500** (configurable by admins).

## Eligibility

Only users **with a role** participate in the reward pool. Users with less than 200 total XP (no role) are excluded.

## Role Multipliers

| Role | Multiplier |
|------|-----------|
| Sprout Leaf 🍃 | 0.75x |
| Green Leaf 🌿 | 1.3x |
| Golden Leaf 🍂 | 2.5x |

## Calculation

1. **Monthly weighted XP** = monthly XP x role multiplier
2. **Point price** = pool / total weighted XP (sum of all eligible users)
3. **Your reward** = your monthly weighted XP x point price

### Example

Pool: $2500. Three eligible users this month:
- User A: 100 monthly XP, Green Leaf (1.3x) = 130 weighted XP
- User B: 80 monthly XP, Sprout Leaf (0.75x) = 60 weighted XP
- User C: 50 monthly XP, Golden Leaf (2.5x) = 125 weighted XP

Total weighted XP: 315. Point price: $2500 / 315 = $7.94

- User A reward: 130 x $7.94 = $1,032
- User B reward: 60 x $7.94 = $476
- User C reward: 125 x $7.94 = $992

## Monthly XP

Only XP earned in the **current month** counts for reward distribution. Sources:
- Base XP from approved work tasks
- Bonus XP awarded by admins during approval

## Checking Your Estimate

Use `/rewards` to view your current monthly reward estimate.

## FAQ

**Q: When are rewards distributed?**
A: At the end of each month based on that month's accumulated XP.

**Q: Do I need to have a role to get rewards?**
A: Yes. Users without a role (< 200 XP) are excluded from the pool.

**Q: Does my role multiplier change my XP?**
A: No, the multiplier only affects reward calculation. Your actual XP stays the same.
