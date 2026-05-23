import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BreadcrumbProvider, useBreadcrumbOverride } from './breadcrumb-context';

describe('breadcrumb-context', () => {
  describe('BreadcrumbProvider', () => {
    it('renders children', () => {
      const { getByText } = render(
        <BreadcrumbProvider overrides={[]} setOverride={() => {}} clearOverride={() => {}}>
          <div>Test Content</div>
        </BreadcrumbProvider>
      );
      expect(getByText('Test Content')).toBeInTheDocument();
    });
  });
});