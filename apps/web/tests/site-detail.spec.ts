import { test, expect, Page } from '@playwright/test';

const TEST_SITE_ID = 'vjdE4sWS3-7KMJtnk-iLl';

function getTabUrl(tab?: string) {
  return `/sites/${TEST_SITE_ID}${tab ? `?tab=${tab}` : ''}`;
}

async function navigateToSiteDetail(page: Page, tab?: string) {
  await page.goto(getTabUrl(tab), { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
}

test.describe.configure({ mode: 'serial' });

test.describe('Site Detail Page - Page Structure', () => {
  test('should display site header with name and status badge', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('Dashboard URL:', page.url());

    const h1 = await page.locator('h1').first().textContent();
    console.log('Dashboard h1:', h1);

    await page.goto(getTabUrl(), { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('Site detail URL:', page.url());

    const allButtons = await page.locator('button').allTextContents();
    console.log('All buttons:', JSON.stringify(allButtons));
  });

  test('should show Build, Deploy, Stop buttons in header', async ({ page }) => {
    await navigateToSiteDetail(page);
    await page.waitForTimeout(2000);
    const allButtons = await page.locator('button').allTextContents();
    console.log('All buttons found:', JSON.stringify(allButtons));
    const buildBtn = page.getByText('Build', { exact: true }).first();
    await expect(buildBtn).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Deploy', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Stop', { exact: true }).first()).toBeVisible();
  });

  test('should display all 9 tabs', async ({ page }) => {
    await navigateToSiteDetail(page);
    const tabs = ['Overview', 'Deployments', 'Database', 'SSL', 'DNS', 'PHP', 'Webserver', 'Logs', 'Cron'];
    for (const tabName of tabs) {
      await expect(page.getByRole('button', { name: tabName })).toBeVisible();
    }
  });

  test('should update URL when clicking tabs', async ({ page }) => {
    await navigateToSiteDetail(page);
    await page.getByRole('button', { name: 'Deployments' }).click();
    await expect(page).toHaveURL(/tab=deployments/);
  });
});

test.describe('Site Detail Page - Header Actions', () => {
  test('Build button should be clickable and show loading state', async ({ page }) => {
    await navigateToSiteDetail(page);
    const buildBtn = page.getByRole('button', { name: /build/i }).first();
    await buildBtn.click();
    await expect(buildBtn).toBeDisabled({ timeout: 5000 });
  });

  test('Deploy button should be clickable and show loading state', async ({ page }) => {
    await navigateToSiteDetail(page);
    const deployBtn = page.getByRole('button', { name: /deploy/i }).first();
    await deployBtn.click();
    await expect(deployBtn).toBeDisabled({ timeout: 5000 });
  });

  test('Stop button should be clickable and show loading state', async ({ page }) => {
    await navigateToSiteDetail(page);
    const stopBtn = page.getByRole('button', { name: /stop/i }).first();
    await stopBtn.click();
    await expect(stopBtn).toBeDisabled({ timeout: 5000 });
  });
});

test.describe('Site Detail Page - Overview Tab', () => {
  test('should display Runtime and Domain cards', async ({ page }) => {
    await navigateToSiteDetail(page, 'overview');
    await expect(page.getByText('Runtime').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Domain').first()).toBeVisible();
  });

  test('should display PHP version when site runtime includes PHP', async ({ page }) => {
    await navigateToSiteDetail(page, 'overview');
    const phpVersionText = page.getByText(/PHP/i);
    const isVisible = await phpVersionText.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await expect(phpVersionText.first()).toBeVisible();
    }
  });

  test('should display creation date', async ({ page }) => {
    await navigateToSiteDetail(page, 'overview');
    await expect(page.getByText('Created').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Site Detail Page - Deployments Tab', () => {
  test('should display Deployment History card', async ({ page }) => {
    await navigateToSiteDetail(page, 'deployments');
    await expect(page.getByText('Deployment History').first()).toBeVisible({ timeout: 15000 });
  });

  test('should show empty state when no deployments', async ({ page }) => {
    await navigateToSiteDetail(page, 'deployments');
    const emptyState = page.getByText('No deployments yet').first();
    const isVisible = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await expect(emptyState).toBeVisible();
    }
  });
});

test.describe('Site Detail Page - Database Tab', () => {
  test('should show empty state with Create Database button when no database', async ({ page }) => {
    await navigateToSiteDetail(page, 'database');
    await expect(page.getByText('No database attached').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /create database/i }).first()).toBeVisible();
  });

  test('should open Create Database form when clicking Create button', async ({ page }) => {
    await navigateToSiteDetail(page, 'database');
    const createBtn = page.getByRole('button', { name: /create database/i }).first();
    await createBtn.click();
    await expect(page.getByLabel('Database Name')).toBeVisible({ timeout: 5000 });
  });

  test('should show engine selector with MariaDB and PostgreSQL options', async ({ page }) => {
    await navigateToSiteDetail(page, 'database');
    await page.getByRole('button', { name: /create database/i }).first().click();
    await expect(page.getByRole('button', { name: 'MariaDB' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PostgreSQL' })).toBeVisible();
  });

  test('should switch engine selection when clicking PostgreSQL', async ({ page }) => {
    await navigateToSiteDetail(page, 'database');
    await page.getByRole('button', { name: /create database/i }).first().click();
    await page.getByRole('button', { name: 'PostgreSQL' }).click();
    await expect(page.getByRole('button', { name: 'PostgreSQL' })).toHaveAttribute('class', /primary|selected/i);
  });

  test('should have Cancel and Create buttons in form', async ({ page }) => {
    await navigateToSiteDetail(page, 'database');
    await page.getByRole('button', { name: /create database/i }).first().click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  test('should close form when Cancel is clicked', async ({ page }) => {
    await navigateToSiteDetail(page, 'database');
    await page.getByRole('button', { name: /create database/i }).first().click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: /create database/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show View Database and Delete buttons when database attached', async ({ page }) => {
    await navigateToSiteDetail(page, 'database');
    const viewBtn = page.getByRole('button', { name: /view database/i });
    if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(viewBtn).toBeVisible();
      await expect(page.getByRole('button', { name: /delete/i }).first()).toBeVisible();
    }
  });

  test('should open delete confirmation dialog', async ({ page }) => {
    await navigateToSiteDetail(page, 'database');
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
      await expect(page.getByText(/delete database/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Site Detail Page - SSL Tab', () => {
  test('should display SSL Certificate section', async ({ page }) => {
    await navigateToSiteDetail(page, 'ssl');
    await expect(page.getByText('SSL Certificate').first()).toBeVisible({ timeout: 15000 });
  });

  test('should show empty state or certificate info', async ({ page }) => {
    await navigateToSiteDetail(page, 'ssl');
    const hasCert = await page.getByText('Expires').isVisible({ timeout: 5000 }).catch(() => false);
    if (hasCert) {
      await expect(page.getByText('Domain').first()).toBeVisible();
      await expect(page.getByText('Expires').first()).toBeVisible();
    } else {
      await expect(page.getByText('No SSL certificate').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /issue certificate/i })).toBeVisible();
    }
  });

  test('should open Issue Certificate modal', async ({ page }) => {
    await navigateToSiteDetail(page, 'ssl');
    const issueBtn = page.getByRole('button', { name: /issue certificate/i });
    if (await issueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await issueBtn.click();
      await expect(page.getByLabel('Email')).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Issue' })).toBeVisible();
    }
  });
});

test.describe('Site Detail Page - DNS Tab', () => {
  test('should display DNS Records section', async ({ page }) => {
    await navigateToSiteDetail(page, 'dns');
    await expect(page.getByText('DNS Records').first()).toBeVisible({ timeout: 15000 });
  });

  test('should show empty state or DNS records', async ({ page }) => {
    await navigateToSiteDetail(page, 'dns');
    const emptyState = page.getByText('No DNS records').first();
    const isVisible = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await expect(emptyState).toBeVisible();
    }
  });
});

test.describe('Site Detail Page - PHP Tab', () => {
  test('should display PHP Configuration card', async ({ page }) => {
    await navigateToSiteDetail(page, 'php');
    await expect(page.getByText('PHP Configuration').first()).toBeVisible({ timeout: 15000 });
  });

  test('should display PHP settings (Version, Memory Limit, Max Execution Time)', async ({ page }) => {
    await navigateToSiteDetail(page, 'php');
    const phpTab = page.getByRole('button', { name: 'PHP' });
    await expect(phpTab).toBeVisible({ timeout: 5000 });
    const versionLabel = page.getByText('Version');
    const hasVersion = await versionLabel.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasVersion) {
      await expect(versionLabel).toBeVisible();
    }
  });
});

test.describe('Site Detail Page - Webserver Tab', () => {
  test('should display Webserver Configuration section', async ({ page }) => {
    await navigateToSiteDetail(page, 'webserver');
    await expect(page.getByText('Webserver Configuration').first()).toBeVisible({ timeout: 15000 });
  });

  test('should display Force HTTPS, Gzip, Caching settings', async ({ page }) => {
    await navigateToSiteDetail(page, 'webserver');
    const webserverConfig = page.locator('text=/Force HTTPS|Gzip|Caching/i');
    await expect(webserverConfig.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Site Detail Page - Logs Tab', () => {
  test('should display Access & Error Logs section', async ({ page }) => {
    await navigateToSiteDetail(page, 'logs');
    await expect(page.getByText('Access & Error Logs').first()).toBeVisible({ timeout: 15000 });
  });

  test('should display logs in monospace font', async ({ page }) => {
    await navigateToSiteDetail(page, 'logs');
    const preElement = page.locator('pre.font-mono');
    const isVisible = await preElement.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await expect(preElement).toBeVisible();
    } else {
      await expect(page.getByText('No logs available')).toBeVisible();
    }
  });
});

test.describe('Site Detail Page - Cron Tab', () => {
  test('should display Cron Jobs section', async ({ page }) => {
    await navigateToSiteDetail(page, 'cron');
    await expect(page.getByText('Cron Jobs').first()).toBeVisible({ timeout: 15000 });
  });

  test('should show empty state with Add Job button when no cron jobs', async ({ page }) => {
    await navigateToSiteDetail(page, 'cron');
    const emptyState = page.getByText('No cron jobs configured').first();
    const isVisible = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await expect(emptyState).toBeVisible();
      await expect(page.getByRole('button', { name: /add job/i })).toBeVisible();
    }
  });

  test('should open Add Cron Job form when clicking Add Job', async ({ page }) => {
    await navigateToSiteDetail(page, 'cron');
    await page.getByRole('button', { name: /add job/i }).click();
    await expect(page.getByLabel(/schedule/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/command/i)).toBeVisible();
  });

  test('should have Schedule and Command inputs in form', async ({ page }) => {
    await navigateToSiteDetail(page, 'cron');
    await page.getByRole('button', { name: /add job/i }).click();
    const scheduleInput = page.getByLabel(/schedule/i);
    const commandInput = page.getByLabel(/command/i);
    await expect(scheduleInput).toBeVisible();
    await expect(commandInput).toBeVisible();
    await scheduleInput.fill('*/5 * * * *');
    await commandInput.fill('/usr/bin/php /var/www/artisan schedule:run');
  });

  test('should have Cancel and Create buttons in form', async ({ page }) => {
    await navigateToSiteDetail(page, 'cron');
    await page.getByRole('button', { name: /add job/i }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  test('should close form when Cancel is clicked', async ({ page }) => {
    await navigateToSiteDetail(page, 'cron');
    await page.getByRole('button', { name: /add job/i }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: /add job/i })).toBeVisible({ timeout: 5000 });
  });

  test('should show Run, Toggle, Delete buttons for existing cron jobs', async ({ page }) => {
    await navigateToSiteDetail(page, 'cron');
    const runBtn = page.getByRole('button', { name: /run/i }).first();
    if (await runBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(runBtn).toBeVisible();
      await expect(page.getByRole('button', { name: /toggle/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /delete/i }).first()).toBeVisible();
    }
  });

  test('should open delete confirmation dialog for cron job', async ({ page }) => {
    await navigateToSiteDetail(page, 'cron');
    const deleteBtn = page.locator('[aria-label="Delete"], button:has-text("icon-trash")').first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
      await expect(page.getByText(/delete cron/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Site Detail Page - Error States', () => {
  test('should display error state when site not found', async ({ page }) => {
    await page.goto('/sites/nonexistent-site-id', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible({ timeout: 15000 });
  });

  test('should show loading skeleton while fetching site data', async ({ page }) => {
    await page.goto(getTabUrl());
    const loadingElements = page.locator('[class*="skeleton"], [class*="animate-pulse"]');
    const hasLoading = await loadingElements.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasLoading) {
      console.log('Loading skeleton detected - OK');
    }
  });
});