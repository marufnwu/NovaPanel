export const TRANSITION_PAGE = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

export const TRANSITION_CARD = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

export const TRANSITION_DROPDOWN = {
  duration: 0.15,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

export const TRANSITION_SPRING = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

export const VARIANTS_PAGE = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
};

export const VARIANTS_CARD = {
  enter: { opacity: 0, y: 4, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1 },
};

export const VARIANTS_FADE = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
};

export const VARIANTS_DROPDOWN = {
  enter: { opacity: 0, y: -4 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const STAGGER_CONTAINER = {
  animate: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};