import React, { useEffect, useState } from 'react';
import {
  Box, Typography, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as CrossIcon,
} from '@mui/icons-material';
import { getActivePolicyApi } from '../api/passwordPolicyApi';

/**
 * Shared password policy checklist — used on Create User, Change Password,
 * and Admin Password Reset screens so users always see the same live rules.
 *
 * Props:
 *   password         — current password text (live-validated)
 *   policy           — optional pre-fetched policy. When omitted the component
 *                      fetches the active policy itself.
 *   onAllPassed      — optional callback(boolean) fired whenever the all-checks
 *                      pass state changes (used to enable Submit buttons).
 *   compact          — if true, uses a tighter layout for inline forms.
 */
const buildChecks = (password, policy) => {
  if (!policy) return [];
  return [
    { label: `At least ${policy.passwordLengthMin} characters`,
      ok: password.length >= policy.passwordLengthMin },
    policy.passwordLengthMax > 0 && {
      label: `At most ${policy.passwordLengthMax} characters`,
      ok: password.length <= policy.passwordLengthMax,
    },
    policy.alphaMin > 0 && {
      label: `At least ${policy.alphaMin} letter(s)`,
      ok: (password.match(/[a-zA-Z]/g) || []).length >= policy.alphaMin,
    },
    policy.upperCaseMin > 0 && {
      label: `At least ${policy.upperCaseMin} uppercase letter(s)`,
      ok: (password.match(/[A-Z]/g) || []).length >= policy.upperCaseMin,
    },
    policy.numericMin > 0 && {
      label: `At least ${policy.numericMin} number(s)`,
      ok: (password.match(/[0-9]/g) || []).length >= policy.numericMin,
    },
    policy.specialCharMin > 0 && {
      label: `At least ${policy.specialCharMin} special char(s)`,
      ok: (password.match(/[^a-zA-Z0-9]/g) || []).length >= policy.specialCharMin,
    },
  ].filter(Boolean);
};

const PasswordPolicyChecklist = ({ password = '', policy: externalPolicy, onAllPassed, compact = false }) => {
  const [policy, setPolicy] = useState(externalPolicy || null);

  useEffect(() => {
    if (externalPolicy) {
      setPolicy(externalPolicy);
      return;
    }
    getActivePolicyApi()
      .then(({ data }) => setPolicy(data?.data || null))
      .catch(() => {}); // best-effort
  }, [externalPolicy]);

  const checks = buildChecks(password, policy);
  const allPassed = checks.length === 0 || checks.every((c) => c.ok);

  // Notify parent (e.g. enable Submit button) when state flips
  useEffect(() => {
    if (typeof onAllPassed === 'function') onAllPassed(allPassed);
  }, [allPassed, onAllPassed]);

  if (!policy || checks.length === 0) return null;

  return (
    <Box
      sx={{
        mt: compact ? 1 : 2,
        p: compact ? 1 : 1.5,
        bgcolor: 'action.hover',
        borderRadius: 1.5,
      }}
    >
      <Typography
        variant="caption"
        fontWeight={600}
        color="text.secondary"
        textTransform="uppercase"
        letterSpacing={0.5}
      >
        Password requirements
      </Typography>
      <List dense disablePadding sx={{ mt: 0.5 }}>
        {checks.map((c) => (
          <ListItem key={c.label} disableGutters sx={{ py: 0.2 }}>
            <ListItemIcon sx={{ minWidth: 22 }}>
              {c.ok
                ? <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                : <CrossIcon sx={{ fontSize: 14, color: 'error.main' }} />}
            </ListItemIcon>
            <ListItemText
              primary={c.label}
              primaryTypographyProps={{
                variant: 'caption',
                color: c.ok ? 'success.main' : 'text.secondary',
              }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default PasswordPolicyChecklist;
