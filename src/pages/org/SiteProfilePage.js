import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Grid, TextField, MenuItem, Button, Alert, Skeleton,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import ErrorAlert from '../../components/ErrorAlert';
import { getSiteApi, updateSiteApi } from '../../api/orgApi';
import { getUsersApi } from '../../api/userApi';
import { ROUTES } from '../../utils/constants';

const SiteProfilePage = () => {
  const [site, setSite]     = useState(null);
  const [users, setUsers]   = useState([]);
  const [form, setForm]     = useState(null);
  const [loading, setLoad]  = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [success, setOk]    = useState(false);

  const fetch = useCallback(async () => {
    setLoad(true); setError(null);
    try {
      const { data } = await getSiteApi();
      const s = data?.data || null;
      setSite(s);
      if (s) setForm({
        name: s.name || '',
        code: s.code || '',
        address: s.address || '',
        headUserId: s.headUserId || '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load site profile.');
    } finally {
      setLoad(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    getUsersApi({ size: 200 })
      .then(({ data }) => setUsers(data?.data?.content || []))
      .catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true); setError(null); setOk(false);
    try {
      await updateSiteApi(site.id, {
        ...form,
        headUserId: form.headUserId || null,
      });
      setOk(true);
      fetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Site Profile"
        subtitle="Single site configuration. Set the Site Head — the final escalation gate for QMS workflows."
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.DASHBOARD },
          { label: 'Organisation', href: ROUTES.ORG_TREE },
          { label: 'Site Profile' },
        ]}
      />

      {error && <ErrorAlert message={error} onRetry={fetch} />}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Site profile updated.</Alert>}

      {(loading || !form) && !error ? (
        <Skeleton height={300} variant="rounded" />
      ) : (
        <Paper component="form" onSubmit={handleSave} autoComplete="off"
               sx={{ p: 3, maxWidth: 720 }}>
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField label="Site Name" required fullWidth value={form.name}
                         onChange={e => setForm({ ...form, name: e.target.value })}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={4}>
              <TextField label="Site Code" fullWidth value={form.code}
                         onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                         helperText="Optional, e.g. SITE-01"
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Address" fullWidth multiline rows={3} value={form.address}
                         onChange={e => setForm({ ...form, address: e.target.value })}
                         inputProps={{ autoComplete: 'off' }} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Site Head" select fullWidth value={form.headUserId}
                         onChange={e => setForm({ ...form, headUserId: e.target.value })}
                         helperText="Required to approve PENDING_SITE_HEAD QMS transitions.">
                <MenuItem value=""><em>Not set</em></MenuItem>
                {users.map(u => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.fullName || u.username} {u.designation ? `· ${u.designation}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sx={{ textAlign: 'right', mt: 1 }}>
              <Button type="submit" variant="contained" startIcon={<SaveIcon />}
                      disabled={saving || !form.name}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default SiteProfilePage;
