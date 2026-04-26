import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Toolbar, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, LinearProgress } from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import Header from './Header';
import { useAuth } from '../store/AuthContext';
import { ROUTES } from '../utils/constants';
import useIdleTimeout from '../hooks/useIdleTimeout';

const WARN_SECONDS = 15; // countdown shown in the dialog

const MainLayout = () => {
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [warnOpen, setWarnOpen]         = useState(false);
  const [countdown, setCountdown]       = useState(WARN_SECONDS);
  const countdownRef                    = useRef(null);
  const { logout }                      = useAuth();
  const navigate                        = useNavigate();

  const doLogout = useCallback(() => {
    clearInterval(countdownRef.current);
    setWarnOpen(false);
    logout();
    navigate(ROUTES.LOGIN);
  }, [logout, navigate]);

  // Start a visual countdown when the warning dialog opens
  const startCountdown = useCallback(() => {
    setCountdown(WARN_SECONDS);
    setWarnOpen(true);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Logout when countdown hits 0
  useEffect(() => {
    if (countdown === 0 && warnOpen) doLogout();
  }, [countdown, warnOpen, doLogout]);

  const { reset: resetIdle } = useIdleTimeout({
    idleMs:  120_000, // 2 minutes total idle
    warnMs:  15_000,  // warn 15 s before logout
    onWarn:  startCountdown,
    onIdle:  doLogout,
  });

  const handleStayLoggedIn = () => {
    clearInterval(countdownRef.current);
    setWarnOpen(false);
    resetIdle(); // restart the full 2-minute timer
  };

  // Cleanup interval on unmount
  useEffect(() => () => clearInterval(countdownRef.current), []);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header onMobileMenuToggle={() => setMobileOpen((p) => !p)} />
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: { md: `${DRAWER_WIDTH}px` },
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          overflow: 'auto',
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Outlet />
        </Box>
      </Box>

      {/* Idle warning dialog */}
      <Dialog open={warnOpen} maxWidth="xs" fullWidth disableEscapeKeyDown>
        <LinearProgress
          variant="determinate"
          value={(countdown / WARN_SECONDS) * 100}
          color="warning"
          sx={{ height: 4 }}
        />
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Session Timeout Warning</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You've been inactive for a while. You will be automatically logged out in:
          </Typography>
          <Typography
            variant="h3"
            fontWeight={700}
            color={countdown <= 5 ? 'error.main' : 'warning.main'}
            textAlign="center"
            sx={{ my: 2 }}
          >
            {countdown}s
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Click <strong>Stay Logged In</strong> to continue your session.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" color="inherit" onClick={doLogout}>
            Logout Now
          </Button>
          <Button variant="contained" onClick={handleStayLoggedIn} autoFocus>
            Stay Logged In
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MainLayout;
