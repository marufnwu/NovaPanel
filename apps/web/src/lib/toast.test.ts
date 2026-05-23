import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast, __registerToastListener } from './toast';

describe('toast', () => {
  let mockListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockListener = vi.fn();
  });

  describe('toast API', () => {
    it('calls listener with success type', () => {
      const unregister = __registerToastListener(mockListener);
      toast.success('Operation completed');
      expect(mockListener).toHaveBeenCalledWith({
        type: 'success',
        message: 'Operation completed',
        title: undefined,
      });
      unregister();
    });

    it('calls listener with error type', () => {
      const unregister = __registerToastListener(mockListener);
      toast.error('Something went wrong', 'Error');
      expect(mockListener).toHaveBeenCalledWith({
        type: 'error',
        message: 'Something went wrong',
        title: 'Error',
      });
      unregister();
    });

    it('calls listener with warning type', () => {
      const unregister = __registerToastListener(mockListener);
      toast.warning('Please be careful', 'Warning');
      expect(mockListener).toHaveBeenCalledWith({
        type: 'warning',
        message: 'Please be careful',
        title: 'Warning',
      });
      unregister();
    });

    it('calls listener with info type', () => {
      const unregister = __registerToastListener(mockListener);
      toast.info('Here is some information');
      expect(mockListener).toHaveBeenCalledWith({
        type: 'info',
        message: 'Here is some information',
        title: undefined,
      });
      unregister();
    });
  });

  describe('listener registration', () => {
    it('registers listener and returns unregister function', () => {
      const unregister = __registerToastListener(mockListener);
      expect(typeof unregister).toBe('function');
      toast.success('test');
      expect(mockListener).toHaveBeenCalled();
      unregister();
    });

    it('does not call listener after unregister', () => {
      const unregister = __registerToastListener(mockListener);
      unregister();
      toast.success('should not call');
      expect(mockListener).not.toHaveBeenCalled();
    });
  });
});