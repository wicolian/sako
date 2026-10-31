import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Timer, Zap, Users, Rocket, Mail, ArrowRight, CheckCircle, AlertCircle, Twitter, Github, Loader2 } from 'lucide-react';

export default function App() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [isLaunched, setIsLaunched] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  // Target: Dec 31, 2025, 12:00 PM IST (UTC+5:30)
  const targetDate = new Date("2025-12-31T12:00:00+05:30").getTime();

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        setIsLaunched(true);
        // Track launch event in Google Analytics before redirecting
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'launch_reached', {
            event_category: 'milestone',
            event_label: 'countdown_complete',
            value: 1
          });
        }
        // Redirect to main site when countdown ends
        setTimeout(() => {
          window.location.href = 'https://trysako.com';
        }, 2000); // Give time for analytics to send
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setShowSuccess(false);
    setShowError(false);

    if (!email || !email.includes('@')) {
      setShowError(true);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join waitlist');
      }

      // Track successful waitlist signup in Google Analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'waitlist_signup', {
          event_category: 'engagement',
          event_label: 'waitlist_form',
          value: 1
        });
      }

      setIsSubmitting(false);
      setShowSuccess(true);
      setEmail('');

      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Error joining waitlist:', error);
      setIsSubmitting(false);
      setShowError(true);
    }
  };

  const formatNumber = (num: number) => num < 10 ? `0${num}` : num;

  return (
    <div className="dark h-screen flex flex-col relative overflow-x-hidden" style={{
      backgroundColor: '#0A0A0A',
      fontFamily: 'var(--font-geist-sans)',
      color: '#FFFFFF'
    }}>
      {/* Ambient Background Glow */}
      <motion.div 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-[600px] rounded-full pointer-events-none z-0"
        style={{ backgroundColor: '#9AE83E', opacity: 0.08, filter: 'blur(120px)' }}
        animate={{
          opacity: [0.05, 0.12, 0.05],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <div className="fixed inset-0 bg-grid z-0 pointer-events-none"></div>
      <div className="fixed inset-0 scanlines z-10 pointer-events-none"></div>

      {/* Top Bar */}
      <motion.header
        className="relative z-30 w-full max-w-6xl mx-auto px-6 py-4 flex justify-center items-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Logo */}
        <motion.a 
          href="#" 
          className="hover:opacity-80 transition-opacity"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <img
            src="/sako-white.svg"
            alt="SAKO"
            className="h-6 sm:h-7"
            style={{ width: 'auto' }}
          />
        </motion.a>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-20 flex-grow flex flex-col items-center justify-center px-4 w-full max-w-4xl mx-auto text-center mt-4 sm:mt-6">
        
        {/* Headlines */}
        <motion.div
          className="space-y-3 mb-8 sm:mb-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <motion.h1
            className="text-white leading-[1.1]"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)', fontWeight: 600, letterSpacing: '-0.025em' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            The gap between strategy and <br className="hidden sm:block" />
            shipping is about to{' '}
            <motion.span 
              style={{ color: '#A3A3A3' }}
              animate={{ 
                color: ['#A3A3A3', '#9AE83E', '#A3A3A3']
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              close.
            </motion.span>
          </motion.h1>
          <motion.p
            style={{
              color: '#A3A3A3',
              fontSize: 'clamp(0.8rem, 1.8vw, 1rem)'
            }}
            className="max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            SAKO goes live on Dec 30, 2025 at 12:00 PM IST. <br className="hidden sm:block"/>
            <span 
              className="text-white"
              style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}
            >
              Redefining the standard.
            </span>
          </motion.p>
        </motion.div>

        {/* Countdown Card */}
        <motion.div 
          className="relative group w-full max-w-3xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.8, ease: "easeOut" }}
        >
          {/* Glow behind timer */}
          <motion.div 
            className="absolute -inset-1 rounded-[2.5rem] blur opacity-20"
            style={{ 
              background: 'linear-gradient(to right, rgba(154, 232, 62, 0.2), transparent)'
            }}
            animate={{
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          <motion.div
            className="relative backdrop-blur-2xl border rounded-[1.5rem] p-6 sm:p-8"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderColor: 'rgba(255,255,255,0.15)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)'
            }}
            whileHover={{ 
              borderColor: 'rgba(154, 232, 62, 0.3)',
              boxShadow: '0 8px 32px 0 rgba(154, 232, 62, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)'
            }}
            transition={{ duration: 0.3 }}
          >
            {!isLaunched ? (
              <>
                {/* Countdown Header */}
                <motion.div
                  className="flex items-center justify-center gap-2 mb-6 opacity-60"
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Timer className="w-4 h-4" style={{ color: '#9AE83E' }} />
                  <span 
                    className="uppercase"
                    style={{ 
                      fontSize: '12px',
                      letterSpacing: '0.1em',
                      color: '#9AE83E'
                    }}
                  >
                    Launching In
                  </span>
                </motion.div>

                {/* Live Timer */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  {/* Days */}
                  <CountdownUnit value={timeLeft.days} label="Days" delay={0} />
                  {/* Hours */}
                  <CountdownUnit value={timeLeft.hours} label="Hours" delay={0.1} />
                  {/* Minutes */}
                  <CountdownUnit value={timeLeft.minutes} label="Mins" delay={0.2} />
                  {/* Seconds */}
                  <div className="flex flex-col items-center relative">
                    <motion.span
                      className="tabular-nums"
                      style={{
                        fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
                        fontWeight: 600,
                        letterSpacing: '-0.05em',
                        color: '#9AE83E'
                      }}
                      key={timeLeft.seconds}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      {formatNumber(timeLeft.seconds)}
                    </motion.span>
                    <span 
                      className="uppercase mt-2"
                      style={{ 
                        fontSize: '12px',
                        color: '#A3A3A3',
                        letterSpacing: '0.05em'
                      }}
                    >
                      Secs
                    </span>
                    <motion.div 
                      className="absolute -right-2 top-2 w-1.5 h-1.5 rounded-full hidden md:block"
                      style={{ backgroundColor: '#9AE83E' }}
                      animate={{ opacity: [0.4, 0.7, 0.4] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <motion.div 
                className="flex flex-col items-center py-10"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
              >
                <motion.h2 
                  className="mb-6"
                  style={{ fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.025em' }}
                  animate={{ 
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  We're live.
                </motion.h2>
                <motion.button 
                  className="rounded-full shadow-lg"
                  style={{ 
                    backgroundColor: '#9AE83E',
                    color: '#0A0A0A',
                    fontSize: '18px',
                    fontWeight: 600,
                    padding: '16px 40px',
                    boxShadow: '0 0 20px rgba(154,232,62,0.4)'
                  }}
                  whileHover={{ 
                    scale: 1.05,
                    backgroundColor: '#8bd635',
                    boxShadow: '0 0 30px rgba(154,232,62,0.6)'
                  }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  Enter Sako
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* Waitlist Capture */}
        <motion.div
          className="w-full max-w-lg mx-auto mt-8 relative z-30"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          <form className="relative group" onSubmit={handleSubmit}>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-[18px] h-[18px]" style={{ color: '#A3A3A3' }} />
                </div>
                <motion.input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com" 
                  className="w-full border text-white rounded-xl py-3.5 pl-11 pr-4 transition-all"
                  style={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    fontSize: '14px'
                  }}
                  whileFocus={{ 
                    borderColor: '#9AE83E',
                    boxShadow: '0 0 0 1px #9AE83E'
                  }}
                />
              </div>
              <motion.button 
                type="submit" 
                className="text-sm py-3.5 px-6 rounded-xl whitespace-nowrap flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: '#9AE83E',
                  color: '#0A0A0A',
                  fontWeight: 600,
                  boxShadow: '0 0 15px -5px rgba(154,232,62,0.5)'
                }}
                whileHover={{ 
                  backgroundColor: '#8bd635',
                  boxShadow: '0 0 20px -5px rgba(154,232,62,0.7)',
                  scale: 1.02
                }}
                whileTap={{ scale: 0.98 }}
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Joining...' : 'Join waitlist'}</span>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </motion.button>
            </div>
            
            {/* Microcopy */}
            <div className="mt-4 flex flex-col items-center gap-1 text-center">
              <p style={{ fontSize: '12px', color: '#A3A3A3' }}>
                Waitlist members get <span className="text-white" style={{ fontWeight: 500 }}>15% off</span> the first month. No spam.
              </p>
              <p style={{ fontSize: '10px', color: '#525252' }}>
                By joining, you agree to receive product updates.
              </p>
            </div>

            {/* Feedback Messages */}
            {showSuccess && (
              <motion.div 
                className="absolute top-full left-0 w-full mt-2 text-center border rounded-lg flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: '#1a1a1a',
                  borderColor: 'rgba(154, 232, 62, 0.3)',
                  color: '#9AE83E',
                  fontSize: '12px',
                  padding: '8px'
                }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                You're in. Check your inbox.
              </motion.div>
            )}
            {showError && (
              <motion.div 
                className="absolute top-full left-0 w-full mt-2 text-center border rounded-lg flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: '#1a1a1a',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '12px',
                  padding: '8px'
                }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                That email looks off. Try again.
              </motion.div>
            )}
          </form>
        </motion.div>

        {/* Credibility Strip */}
        <motion.div
          className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 w-full max-w-3xl border-t pt-6 sm:pt-8 mb-6"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
        >
          <CredibilityItem 
            icon={<Zap className="w-5 h-5" style={{ color: '#9AE83E' }} />}
            text="48h delivery system"
            delay={0}
          />
          <CredibilityItem 
            icon={<Users className="w-5 h-5" style={{ color: '#9AE83E' }} />}
            text="Design + ops, not freelancers"
            delay={0.1}
          />
          <CredibilityItem 
            icon={<Rocket className="w-5 h-5" style={{ color: '#9AE83E' }} />}
            text="Built for teams that ship"
            delay={0.2}
          />
        </motion.div>
      </main>
    </div>
  );
}

function CountdownUnit({ value, label, delay }: { value: number; label: string; delay: number }) {
  const formatNumber = (num: number) => num < 10 ? `0${num}` : num;
  
  return (
    <motion.div 
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2 + delay, duration: 0.6 }}
    >
      <motion.span
        className="text-white tabular-nums"
        style={{
          fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
          fontWeight: 600,
          letterSpacing: '-0.05em'
        }}
        key={value}
        initial={{ scale: 1.1, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {formatNumber(value)}
      </motion.span>
      <span 
        className="uppercase mt-2"
        style={{ 
          fontSize: '12px',
          color: '#A3A3A3',
          letterSpacing: '0.05em'
        }}
      >
        {label}
      </span>
    </motion.div>
  );
}

function CredibilityItem({ icon, text, delay }: { icon: React.ReactNode; text: string; delay: number }) {
  return (
    <motion.div 
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1.5 + delay, duration: 0.6 }}
      whileHover={{ x: 5 }}
    >
      <motion.div
        animate={{ 
          rotate: [0, 5, -5, 0],
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3
        }}
      >
        {icon}
      </motion.div>
      <span 
        className="uppercase"
        style={{ 
          fontSize: '12px',
          color: '#A3A3A3',
          letterSpacing: '0.05em'
        }}
      >
        {text}
      </span>
    </motion.div>
  );
}