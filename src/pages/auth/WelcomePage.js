import React, { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import { useAuth } from '../../store/AuthContext';

/**
 * WelcomePage — splash shown at the site root (/).
 *
 * Design intent (per spec, 2026-10-08):
 *   • Same gradient background as [LoginPage] so the two feel like one surface.
 *   • Large "Welcome to Baserastech QMS" headline, animated-in.
 *   • Any click, tap, keypress, or scroll → navigate to /login.
 *
 * We short-circuit to the dashboard if the user already has an active session,
 * so returning users don't bounce through the splash on every reload.
 */
const WelcomePage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Already signed in → skip the splash on refresh.
  useEffect(() => {
    if (isAuthenticated) navigate(ROUTES.DASHBOARD, { replace: true });
  }, [isAuthenticated, navigate]);

  const goToLogin = () => navigate(ROUTES.LOGIN);

  // Any key other than Tab (which is needed for a11y focus) advances. Space /
  // Enter are the obvious ones but we don't want to swallow Tab-to-focus.
  const onKeyDown = (e) => {
    if (e.key !== 'Tab') goToLogin();
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label="Enter Baserastech QMS — press any key or click to go to the login screen"
      onClick={goToLogin}
      onKeyDown={onKeyDown}
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        // Match LoginPage gradient exactly so the two screens feel like one.
        background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 50%, #1A237E 100%)',
        cursor: 'pointer',
        userSelect: 'none',
        outline: 'none',
        color: '#FFFFFF',
      }}
    >
      {/* Subtle brand chip above the headline — mirrors the look used on the PPT deck. */}
      <Box
        sx={{
          px: 1.75, py: 0.5, mb: 3,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(4px)',
          letterSpacing: '0.14em',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: '#E3F2FD',
        }}
      >
        Baseras Tech LLP
      </Box>

      <Typography
        component="h1"
        sx={{
          fontWeight: 700,
          textAlign: 'center',
          lineHeight: 1.15,
          // Fluid between phones and desktops.
          fontSize: { xs: 36, sm: 54, md: 72 },
          letterSpacing: '-0.5px',
          mb: 2,
          // Soft fade-in on first mount.
          animation: 'wq-fade-in 700ms ease-out',
          '@keyframes wq-fade-in': {
            from: { opacity: 0, transform: 'translateY(8px)' },
            to:   { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        Welcome to Baserastech QMS
      </Typography>

      <Typography
        sx={{
          color: '#CADCFC',
          fontSize: { xs: 14, sm: 16 },
          mb: 6,
          textAlign: 'center',
          maxWidth: 620,
          animation: 'wq-fade-in 900ms ease-out',
        }}
      >
        Quality Management Software for regulated manufacturing — Change Control,
        CAPA, Deviation, Incident, Market Complaint.
      </Typography>

      <Typography
        sx={{
          color: '#90CAF9',
          fontSize: 13,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          // Gentle pulse to signal interactivity without being noisy.
          animation: 'wq-pulse 1800ms ease-in-out infinite',
          '@keyframes wq-pulse': {
            '0%, 100%': { opacity: 0.65 },
            '50%':      { opacity: 1 },
          },
        }}
      >
        Click anywhere to continue
      </Typography>
    </Box>
  );
};

export default WelcomePage;
