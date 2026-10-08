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
      {/* Shared keyframes live on this root box so every child reaches them. */}
      <Box
        sx={{
          position: 'absolute', width: 0, height: 0, overflow: 'hidden',
          '@keyframes wq-rise': {
            from: { opacity: 0, transform: 'translateY(22px)' },
            to:   { opacity: 1, transform: 'translateY(0)' },
          },
          '@keyframes wq-fade-in': {
            from: { opacity: 0 },
            to:   { opacity: 1 },
          },
          '@keyframes wq-shimmer': {
            '0%':   { backgroundPosition: '-200% 0' },
            '100%': { backgroundPosition: '200% 0' },
          },
          '@keyframes wq-pulse': {
            '0%, 100%': { opacity: 0.65 },
            '50%':      { opacity: 1 },
          },
          '@keyframes wq-underline-draw': {
            from: { transform: 'scaleX(0)' },
            to:   { transform: 'scaleX(1)' },
          },
        }}
      />

      {/* Brand chip above the headline — subtle entrance from above. */}
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
          opacity: 0,
          animation: 'wq-fade-in 600ms ease-out 100ms forwards',
        }}
      >
        Baseras Tech Pvt Ltd
      </Box>

      {/* Headline — each word rises in sequence; the brand word "Baserastech"
          gets a slow shimmer sweep + an animated underline draw to feel alive
          without being noisy. */}
      <Box
        component="h1"
        sx={{
          m: 0, p: 0,
          fontWeight: 700,
          textAlign: 'center',
          lineHeight: 1.15,
          fontSize: { xs: 36, sm: 54, md: 72 },
          letterSpacing: '-0.5px',
          mb: 2,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: { xs: '0.25em', sm: '0.3em' },
          '& > span': {
            display: 'inline-block',
            opacity: 0,
            // Shared timing. Each word overrides animationDelay below.
            animation: 'wq-rise 700ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
          },
        }}
      >
        <Box component="span" sx={{ animationDelay: '150ms' }}>Welcome</Box>
        <Box component="span" sx={{ animationDelay: '300ms' }}>to</Box>
        <Box
          component="span"
          sx={{
            animationDelay: '450ms',
            // Brand word: shimmer sweep + hand-drawn underline.
            position: 'relative',
            background:
              'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 42%, #FFEE58 50%, #FFFFFF 58%, #FFFFFF 100%)',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent',
            // Shimmer kicks in after the rise lands.
            animation:
              'wq-rise 700ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards, ' +
              'wq-shimmer 3800ms linear 1200ms infinite',
            '&::after': {
              content: '""',
              position: 'absolute',
              left: 0, right: 0, bottom: '-0.08em',
              height: '3px',
              borderRadius: '3px',
              background:
                'linear-gradient(90deg, rgba(255,238,88,0) 0%, #FFEE58 50%, rgba(255,238,88,0) 100%)',
              transform: 'scaleX(0)',
              transformOrigin: 'left center',
              animation: 'wq-underline-draw 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 1100ms forwards',
            },
          }}
        >
          Baserastech
        </Box>
        <Box component="span" sx={{ animationDelay: '600ms' }}>QMS</Box>
      </Box>

      <Typography
        sx={{
          color: '#CADCFC',
          fontSize: { xs: 14, sm: 16 },
          mb: 6,
          textAlign: 'center',
          maxWidth: 620,
          opacity: 0,
          animation: 'wq-fade-in 900ms ease-out 1200ms forwards',
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
          opacity: 0,
          // Delay the cue until after the headline has fully landed, then pulse.
          animation:
            'wq-fade-in 600ms ease-out 1700ms forwards, ' +
            'wq-pulse 1800ms ease-in-out 2300ms infinite',
        }}
      >
        Click anywhere to continue
      </Typography>
    </Box>
  );
};

export default WelcomePage;
