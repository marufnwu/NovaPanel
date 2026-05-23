import { describe, it, expect } from 'vitest';
import {
  TRANSITION_PAGE,
  TRANSITION_CARD,
  TRANSITION_DROPDOWN,
  TRANSITION_SPRING,
  VARIANTS_PAGE,
  VARIANTS_CARD,
  VARIANTS_FADE,
  VARIANTS_DROPDOWN,
  STAGGER_CONTAINER,
} from '@/lib/motion';

describe('Motion Constants', () => {
  describe('Transition Constants', () => {
    it('TRANSITION_PAGE has correct structure', () => {
      expect(TRANSITION_PAGE).toEqual({
        duration: 0.25,
        ease: [0.25, 0.1, 0.25, 1],
      });
    });

    it('TRANSITION_CARD has correct structure', () => {
      expect(TRANSITION_CARD).toEqual({
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1],
      });
    });

    it('TRANSITION_DROPDOWN has correct structure', () => {
      expect(TRANSITION_DROPDOWN).toEqual({
        duration: 0.15,
        ease: [0.25, 0.1, 0.25, 1],
      });
    });

    it('TRANSITION_SPRING has correct structure', () => {
      expect(TRANSITION_SPRING).toEqual({
        type: 'spring',
        stiffness: 400,
        damping: 30,
      });
    });
  });

  describe('Variants Constants', () => {
    it('VARIANTS_PAGE has enter, center, and exit states', () => {
      expect(VARIANTS_PAGE.enter).toEqual({ opacity: 0, y: 8 });
      expect(VARIANTS_PAGE.center).toEqual({ opacity: 1, y: 0 });
      expect(VARIANTS_PAGE.exit).toEqual({ opacity: 0 });
    });

    it('VARIANTS_CARD has enter, center, and exit states', () => {
      expect(VARIANTS_CARD.enter).toEqual({ opacity: 0, y: 4, scale: 0.98 });
      expect(VARIANTS_CARD.center).toEqual({ opacity: 1, y: 0, scale: 1 });
    });

    it('VARIANTS_FADE has enter and center states', () => {
      expect(VARIANTS_FADE.enter).toEqual({ opacity: 0 });
      expect(VARIANTS_FADE.center).toEqual({ opacity: 1 });
    });

    it('VARIANTS_DROPDOWN has enter, center, and exit states', () => {
      expect(VARIANTS_DROPDOWN.enter).toEqual({ opacity: 0, y: -4 });
      expect(VARIANTS_DROPDOWN.center).toEqual({ opacity: 1, y: 0 });
      expect(VARIANTS_DROPDOWN.exit).toEqual({ opacity: 0, y: -4 });
    });
  });

  describe('Stagger Container', () => {
    it('STAGGER_CONTAINER has correct animate structure', () => {
      expect(STAGGER_CONTAINER.animate).toBeDefined();
      expect(STAGGER_CONTAINER.animate.transition).toBeDefined();
      expect(STAGGER_CONTAINER.animate.transition.staggerChildren).toBe(0.03);
      expect(STAGGER_CONTAINER.animate.transition.delayChildren).toBe(0.05);
    });
  });
});