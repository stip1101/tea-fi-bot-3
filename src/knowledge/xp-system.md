# XP System (Experience Points)

## What is XP?

XP (Experience Points) measures your contribution to the TeaFi Program. XP determines your role and affects your share of the monthly reward pool.

## XP Sources

| Source | Description |
|--------|-------------|
| work_approved | Base XP from the task, awarded on approval |
| bonus | Optional bonus XP awarded by admin during approval |
| admin_adjustment | Manual XP adjustment by admin |

## Base XP

Each task has a fixed XP reward defined by admins. When your work is approved, you automatically receive the task's base XP.

## Bonus XP

Admins can award optional bonus XP during work approval. This is extra XP on top of the base task reward for exceptional work.

## Monthly XP

Only XP earned in the current month counts for reward pool distribution. Monthly XP comes from:
- Work approvals (base XP from tasks)
- Bonus XP awarded during approvals
- Admin adjustments

## XP History

All XP changes are tracked in the xp_history table with source, amount, and timestamp.

## Where to Check XP?

- `/profile` — your Tea Card with current XP
- `/leaderboard` — XP leaderboard

## FAQ

**Q: Can I lose XP?**
A: XP only changes through admin adjustments. Normal XP from work approvals is permanent.

**Q: How to earn more XP?**
A: Submit work for tasks and get approved. Higher-value tasks award more base XP.

**Q: When is XP credited?**
A: Immediately after work is approved by an admin.

**Q: What is the difference between base XP and bonus XP?**
A: Base XP is the fixed reward defined for each task. Bonus XP is extra XP optionally awarded by the admin during approval.
