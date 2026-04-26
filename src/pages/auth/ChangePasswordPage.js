import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Alert, InputAdornment,
  IconButton, Divider, List, ListItem, ListItemIcon, ListItemText, Chip,
} from '@mui/material';
import {
  Lock as LockIcon,
  Visibility, VisibilityOff,
  CheckCircle as CheckIcon,
  Cancel as CrossIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { changePasswordApi } from '../../api/authApi';
import { getActivePolicyApi } from '../../api/passwordPolicyApi';
import { useAuth } from '../../store/AuthContext';
import { ROUTES } from '../../utils/constants';

// Check a single password against the active policy
const buildChecks = (password, policy) => {
  if (!policy) return [];
  return [
    { label: `At least ${policy.passwordLengthMin} characters`, ok: password.length >= policy.passwordLengthMin },
    policy.passwordLengthMax > 0 && { label: `At most ${policy.passwordLengthMax} characters`, ok: password.length <= policy.passwordLengthMax },
    policy.alphaMin > 0    && { label: `At least ${policy.alphaMin} letter(s)`,           ok: (password.match(/[a-zA-Z]/g) || []).length >= policy.alphaMin },
    policy.upperCaseMin > 0 && { label: `At least ${policy.upperCaseMin} uppercase letter(s)`, ok: (password.match(/[A-Z]/g) || []).length >= policy.upperCaseMin },
    policy.numericMin > 0  && { label: `At least ${policy.numericMin} number(s)`,          ok: (password.match(/[0-9]/g) || []).length >= policy.numericMin },
    policy.specialCharMin > 0 && { label: `At least ${policy.specialCharMin} special char(s)`, ok: (password.match(/[^a-zA-Z0-9]/g) || []).length >= policy.specialCharMin },
  ].filter(Boolean);
};

const ChangePasswordPage = () => {
  const { user, clearMustChangePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getActivePolicyApi()
      .then(({ data }) => setPolicy(data?.data || null))
      .catch(() => {}); // policy fetch is best-effort
  }, []);

  const checks = buildChecks(form.newPassword, policy);
  const allChecksPassed = checks.length === 0 || checks.every((c) => c.ok);
  const passwordsMatch = form.newPassword === form.confirmPassword && form.confirmPassword.length > 0;
  const canSubmit = form.currentPassword.length > 0 && form.newPassword.length > 0 && passwordsMatch && allChecksPassed;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await changePasswordApi(user.id, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      setSuccess(true);
      clearMustChangePassword();
      setTimeout(() => navigate(ROUTES.DASHBOARD), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 480 }}>
        {/* Header card */}
        <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{ bgcolor: 'primary.main', borderRadius: 1.5, p: 1, display: 'flex' }}>
              <LockIcon sx={{ color: 'white', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>Change Your Password</Typography>
              <Typography variant="body2" color="text.secondary">
                Your account requires a password change before continuing.
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {success ? (
            <Alert severity="success" icon={<CheckIcon />}>
              Password changed successfully! Redirecting…
            </Alert>
          ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <TextField
                label="Current Password"
                type={showCurrent ? 'text' : 'password'}
                fullWidth
                required
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowCurrent((p) => !p)}>
                        {showCurrent ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="New Password"
                type={showNew ? 'text' : 'password'}
                fullWidth
                required
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowNew((p) => !p)}>
                        {showNew ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Confirm New Password"
                type={showConfirm ? 'text' : 'password'}
                fullWidth
                required
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                error={form.confirmPassword.length > 0 && !passwordsMatch}
                helperText={form.confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : ''}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowConfirm((p) => !p)}>
                        {showConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Policy checks — shown as soon as user starts typing */}
              {checks.length > 0 && form.newPassword.length > 0 && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5 }}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
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
                          primaryTypographyProps={{ variant: 'caption', color: c.ok ? 'success.main' : 'text.secondary' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={!canSubmit || saving}
                sx={{ mt: 3 }}
              >
                {saving ? 'Changing Password…' : 'Change Password'}
              </Button>

              <Button
                fullWidth
                variant="text"
                color="inherit"
                size="small"
                onClick={handleLogout}
                sx={{ mt: 1, color: 'text.secondary' }}
              >
                Sign out instead
              </Button>
            </Box>
          )}
        </Paper>

        {/* Active policy summary pill */}
        {policy && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            <Chip size="small" label={`Min length: ${policy.passwordLengthMin}`} variant="outlined" />
            {policy.upperCaseMin > 0 && <Chip size="small" label={`Uppercase: ${policy.upperCaseMin}`} variant="outlined" />}
            {policy.numericMin > 0 && <Chip size="small" label={`Numbers: ${policy.numericMin}`} variant="outlined" />}
            {policy.specialCharMin > 0 && <Chip size="small" label={`Special: ${policy.specialCharMin}`} variant="outlined" />}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ChangePasswordPage;
