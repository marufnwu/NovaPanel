# NovaPanel Modern UI Redesign Plan

**Version:** 1.0  
**Date:** 2026-05-10  
**Status:** Planning  
**Inspiration:** Vercel Dashboard, Linear, Railway, Planetscale

---

## Executive Summary

The current NovaPanel UI suffers from dated design patterns that reduce user efficiency and create cognitive overhead. This plan outlines a comprehensive redesign following modern SaaS dashboard conventions used by leading developer tools. The redesign prioritizes **progressive disclosure**, **contextual actions**, and **visual hierarchy** over dense data presentation.

### Key Problems Addressed

| # | Issue | Impact | Solution |
|---|-------|--------|----------|
| 1 | Dense tables everywhere | Hard to scan, overwhelming | Card grid layouts with visual hierarchy |
| 2 | Modal overload | Context loss, can't compare | Slide-over drawers |
| 3 | Inconsistent detail views | Confusion, learning curve | Unified detail pattern |
| 4 | Massive inline forms | Intimidation, errors | Wizard/stepper flows |
| 5 | No skeleton loaders | Perceived slowness | Skeleton + shimmer animations |
| 6 | Inconsistent styling | Unprofessional feel | Design token system |
| 7 | Hidden destructive actions | Accidental clicks, fear | Prominent but safe patterns |
| 8 | No keyboard shortcuts | Power user friction | Command palette |
| 9 | Duplicate breadcrumbs | Redundancy, space waste | Single source of truth |
| 10 | No deep-link support | Shareability issues | URL-first architecture |

---

## 1. Design Philosophy

### Core Principles

| Principle | Description | Example |
|-----------|-------------|---------|
| **Progressive Disclosure** | Show only what's needed, reveal more on demand | Collapsed sections, "Show more" patterns |
| **Contextual Actions** | Actions near their subject matter | Floating action buttons, inline editing |
| **Visual Hierarchy** | Clear information priority | Typography scale, spacing, color |
| **Keyboard-First** | Power users can navigate without mouse | Global shortcuts, command palette |
| **Zero State Excellence** | Beautiful empty states guide users | Illustrated placeholders with CTAs |
| **Responsible Animation** | Motion communicates state, not decoration | Subtle transitions, skeleton shimmer |

### Visual Language

**Reference:** Vercel/Linear aesthetic
- **Backgrounds:** Subtle gray gradients, not pure white or flat gray
- **Cards:** Slight elevation with soft shadows, rounded corners (8-12px)
- **Borders:** Subtle, often just 1px with low opacity
- **Accent Colors:** Single primary color, semantic colors for status
- **Typography:** Clean sans-serif, clear hierarchy through weight/size

### Spacing System

```
Base unit: 4px
- xs: 4px   (tight gaps)
- sm: 8px   (component internal)
- md: 16px  (between related elements)
- lg: 24px  (section separation)
- xl: 32px  (page sections)
- 2xl: 48px (major divisions)
```

### Typography Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `text-xs` | 12px | 400 | Captions, metadata |
| `text-sm` | 14px | 400/500 | Body text, labels |
| `text-base` | 16px | 400 | Primary content |
| `text-lg` | 18px | 500 | Section headers |
| `text-xl` | 20px | 600 | Page titles |
| `text-2xl` | 24px | 600 | Major headings |
| `text-3xl` | 30px | 700 | Dashboard metrics |

---

## 2. Layout System

### Overall Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Top Bar (56px fixed)                                           │
│  [Logo] [Breadcrumbs] ──────────── [Search/Cmd+K] [User] [⚙️]  │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│  Sidebar   │  Content Area                                      │
│  (240px)   │  (Fluid, max-width: 1400px centered)                │
│            │                                                    │
│  Collapsed │  ┌──────────────────────────────────────────────┐  │
│  to 64px   │  │ Page Header                                 │  │
│            │  │ [Title] [Description] ─────── [Primary CTA]  │  │
│            │  ├──────────────────────────────────────────────┤  │
│            │  │                                              │  │
│            │  │ Main Content Area                            │  │
│            │  │ (Cards, Tables, or Detail Views)            │  │
│            │  │                                              │  │
│            │  │                                              │  │
│            │  └──────────────────────────────────────────────┘  │
│            │                                                    │
└────────────┴────────────────────────────────────────────────────┘
                                              │
                           ┌──────────────────┴──────────────────┐
                           │  Slide-over Drawer (when active)   │
                           │  (480px width, right side)         │
                           │                                     │
                           │  [Header] [Tabs] ────── [Close]     │
                           │  ─────────────────────────────────  │
                           │                                     │
                           │  [Content]                          │
                           │                                     │
                           │  ─────────────────────────────────  │
                           │  [Footer Actions]                   │
                           └─────────────────────────────────────┘
```

### Sidebar Redesign

**Current Issues:**
- Too wide (280px)
- Nested menus create confusion
- No collapse option
- Icons too small/unclear

**New Sidebar Design:**

```
┌────────────────┐
│  [Logo]  [≡]  │  ← 64px collapsed, 240px expanded
├────────────────┤
│                │
│  📊 Dashboard  │  ← Icon + Label
│  🌐 Websites   │     Active: blue bg tint
│  📧 Domains    │     Hover: subtle bg
│  💾 Databases  │
│  🔒 SSL        │
│  📁 Files      │  ← Collapsible group
│    └─ File Manager
│    └─ FTP Accounts
│  🛡️ Firewall   │
│  ⚙️ Settings   │
│                │
├────────────────┤
│  [?] Help      │  ← Bottom pinned
│  [☁️] tunnels  │
└────────────────┘
       ↓
  Collapsed State:
  ┌────┐
  │ 🏠 │  ← Tooltip on hover
  │ 🌐 │
  │ 📧 │
  │ 💾 │
  │ .. │
  └────┘
```

**Improvements:**
- Collapse to 64px icon-only mode
- Tooltip labels when collapsed
- Smooth width transition animation
- Persistent collapse preference in localStorage
- Clear active state with accent color
- Collapsible sections with rotation animation on chevron

### Top Bar Redesign

**Current Issues:**
- Breadcrumbs duplicated from page content
- Search not prominent
- User menu hard to access

**New Top Bar Design:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ [≡] NovaPanel                    Dashboard > Websites > example.com    │
│                                                                            │
│                                                                            │
├────────────────────────────────────────────────────────────────────────┤
│                     │                                                    │
│  Content flows here │   (Sidebar hidden on mobile, hamburger menu)      │
│                     │                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

**Actually, let's reconsider:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ [≡] [NovaPanel Logo]  │  Dashboard  │  Websites  │  Domains  │         │
│                       │──────────────┼───────────┼──────────│ [🔍] [👤]│
├───────────────────────┴──────────────┴───────────┴──────────┴─────────┤
│                                                                        │
│  [Breadcrumb in page header, not top bar]                             │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Changes:**
- Remove breadcrumb from top bar (it's in page header)
- Add global search/command palette trigger (Cmd+K)
- User avatar with dropdown menu
- Notification bell with badge count
- Clean, minimal design

### Content Area Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  Page Header                                                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ [Page Icon] Page Title                              [Actions] │  │
│  │             Page description & context                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Filter/Search Bar (when applicable)                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ [🔍 Search...]                [Filter ▼] [Sort ▼] [+ Create]  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Main Content                                                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  Card Grid or Table or Detail Content                         │  │
│  │                                                               │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Pagination (when applicable)                                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              « 1 2 3 4 5 ... 12 »                    20 items │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. List Pages Redesign

### Card Grid vs Table Decision Matrix

| Content Type | Recommended Layout | Rationale |
|--------------|-------------------|-----------|
| Websites | Card Grid | Visual favicon, status indicator, quick actions |
| Databases | Cards | Small dataset, status-focused |
| Domains | Cards (grouped) | Expiry dates, renewal status prominent |
| SSL Certificates | Cards | Expiry tracking, visual cert info |
| DNS Records | Table | Structured data, many rows |
| FTP Accounts | Cards | Small dataset |
| Databases | Cards | Quick status, size info |
| Installed Apps | Card Grid | Visual logos, status |
| Files | Traditional | File browser paradigm |

### Card Component Design

**Website Card Example:**

```
┌─────────────────────────────────────────────────────────┐
│  ┌────┐                                                │
│  │ 🟢 │  example.com                         [⋯]      │
│  └────┘  PHP 8.2 • Ubuntu 22.04                       │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  📊 2.4K visitors     💾 450MB     🔒 Valid SSL       │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  [View Details]                      [Open Site →]    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Card Anatomy:**

```
┌────────────────────────────────────────────┐
│  Status    Title              Actions     │  ← Header (border-bottom)
│  Badge     Subtitle                         │
├────────────────────────────────────────────┤
│                                            │
│  Key Metrics / Visual Info                 │  ← Body (variable height)
│                                            │
├────────────────────────────────────────────┤
│  [Secondary Action]     [Primary Action]  │  ← Footer (border-top)
└────────────────────────────────────────────┘
```

**Card States:**
- **Default:** Subtle shadow, white background
- **Hover:** Elevated shadow, slight scale (1.01)
- **Selected:** Blue border accent
- **Loading:** Skeleton with shimmer animation

### Responsive Grid Behavior

```
Desktop (≥1280px):  3-4 columns
Tablet (≥768px):    2 columns  
Mobile (<768px):    1 column, full-width cards
```

### Search & Filter Bar

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔍 Search websites...                            [+ New Website]       │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                               │
│  │ Status ▼ │  │ PHP ▼   │  │ Sort ▼   │                               │
│  └──────────┘  └──────────┘  └──────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detail Pages

### Pattern Decision: Drawer vs Route

| Scenario | Pattern | Rationale |
|----------|---------|-----------|
| Quick view / Edit | Drawer | Context preserved, fast access |
| Complex configuration | Route | Full page, multiple tabs |
| Comparison needed | Route | Can open multiple tabs |
| Primary workflow | Route | Bookmarkable, shareable |
| Secondary info | Drawer | Doesn't interrupt main flow |

### Slide-over Drawer Pattern

**Drawer Anatomy:**

```
┌────────────────────────────────────────────────────────────────────────┐
│                     │                                                │
│                     │  ┌──────────────────────────────────────────┐   │
│                     │  │ [←]  example.com                     [✕] │   │
│    Main List        │  ├──────────────────────────────────────────┤   │
│    (dimmed/80%)     │  │                                          │   │
│                     │  │  [Overview] [DNS] [SSL] [Settings]       │   │
│                     │  │  ─────────────────────────────────────── │   │
│                     │  │                                          │   │
│                     │  │  Drawer Content                          │   │
│                     │  │                                          │   │
│                     │  │                                          │   │
│                     │  │                                          │   │
│                     │  ├──────────────────────────────────────────┤   │
│                     │  │  [Cancel]            [Save Changes]     │   │
│                     │  └──────────────────────────────────────────┘   │
│                     │                                                │
└─────────────────────┴────────────────────────────────────────────────┘
```

**Drawer Specifications:**
- Width: 480px (40% of viewport, max 600px)
- Background: White/surface with shadow
- Header: Sticky with title and close button
- Footer: Sticky with actions
- Transition: Slide in from right (300ms ease-out)
- Backdrop: Semi-transparent black (rgba(0,0,0,0.3))
- Close: Click backdrop, ESC key, or ✕ button

### Route-based Detail Pages

For complex configurations requiring multiple tabs/sections:

```
/websites/:id              → Overview tab
/websites/:id/dns           → DNS records
/websites/:id/ssl           → SSL certificates
/websites/:id/settings      → Website settings
/websites/:id/logs          → Access/error logs
```

**Full Page Detail Layout:**

```
┌────────────────────────────────────────────────────────────────────────┐
│  Page Header (sticky)                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [← Back]   example.com                            [Actions ▼]   │  │
│  │            PHP 8.2 • Ubuntu 22.04 • Created Jan 2024           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│  Tab Navigation (sticky below header)                                  │
│  ┌────────┬────────┬────────┬────────┬────────┐                       │
│  │Overview│  DNS   │  SSL   │Settings│  Logs  │                       │
│  └────────┴────────┴────────┴────────┴────────┘                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Tab Content Area (scrollable)                                         │
│                                                                          │
│                                                                          │
│                                                                          │
│                                                                          │
│                                                                          │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Forms & Wizards

### Wizard Flow for Website Creation

**Step 1: Basic Info**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Create New Website                                   │
│                                                                         │
│                    ① ─── ② ─── ③ ─── ④                                │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Domain Name *                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │ example.com                                                   │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌──────────────────────┐                                         │  │
│  │  │ 🌐 Production        │  ← Radio selection                     │  │
│  │  │ 🧪 Staging           │                                         │  │
│  │  │ 📝 Development       │                                         │  │
│  │  └──────────────────────┘                                         │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                              [Cancel]           [Next: Configure →]     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step 2: Technology Stack**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Create New Website                                   │
│                                                                         │
│                    ① ─── ② ─── ③ ─── ④                                │
│                         ●                                               │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  PHP Version                                                       │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                     │  │
│  │  │ 8.1    │ │ 8.2 ✓  │ │ 8.3    │ │ None   │                     │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘                     │  │
│  │                                                                    │  │
│  │  Application Stack                                                 │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │ ○ None (Static HTML)                                        │  │  │
│  │  │ ○ WordPress              [Learn more ↗]                      │  │  │
│  │  │ ○ Laravel                [Learn more ↗]                      │  │  │
│  │  │ ○ Custom                 [Specify below]                     │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  Root Directory (optional)                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │ /var/www/example.com                                         │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                [← Back]                        [Next: Review →]        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step 3: SSL & Security**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Create New Website                                   │
│                                                                         │
│                    ① ─── ② ─── ③ ─── ④                                │
│                              ●                                          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  ☑ Auto-generate SSL certificate (Let's Encrypt)                 │  │
│  │                                                                    │  │
│  │  ☑ Force HTTPS redirect                                           │  │
│  │                                                                    │  │
│  │  ☑ Enable HSTS                                                    │  │
│  │                                                                    │  │
│  │  ℹ️ SSL will be configured automatically after DNS propagation   │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                [← Back]                        [Next: Review →]          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step 4: Review & Create**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Create New Website                                   │
│                                                                         │
│                    ① ─── ② ─── ③ ─── ④                                │
│                                        ●                                │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Review Configuration                                              │  │
│  │                                                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐ │  │
│  │  │ Domain:          example.com                                  │ │  │
│  │  │ Environment:     Production                                  │ │  │
│  │  │ PHP Version:     8.2                                          │ │  │
│  │  │ Application:     WordPress                                    │ │  │
│  │  │ Root Directory:  /var/www/example.com                         │ │  │
│  │  │ SSL:             Auto (Let's Encrypt)                         │ │  │
│  │  └─────────────────────────────────────────────────────────────┘ │  │
│  │                                                                    │  │
│  │  ⚠️ DNS A record must point to 192.168.1.1 before proceeding     │  │
│  │                                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                [← Back]                    [✓ Create Website]          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Wizard Component Specifications

| Aspect | Specification |
|--------|---------------|
| Width | 640px centered |
| Step indicator | Horizontal numbered steps with connecting lines |
| Navigation | Back/Next buttons, step click to navigate (if valid) |
| Validation | Per-step validation before proceeding |
| Progress | Persist to localStorage for recovery |
| Animation | Step transition: slide left/right based on direction |

### Inline Form Improvements

For simple, quick forms (e.g., DNS record add):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Add DNS Record                                                         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Type    │  Name      │  Value                     │  TTL          │ │
│  ├──────────┼────────────┼────────────────────────────┼───────────────┤ │
│  │  A    ▼  │  www     │  192.168.1.1               │  Auto      ▼  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│                              [+ Add Another]                            │
│                                                                         │
│                              [Cancel]              [Save Records]       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Standards

### Design Token System

**Color Palette:**

```css
:root {
  /* Primary - Blue */
  --color-primary-50: #EFF6FF;
  --color-primary-100: #DBEAFE;
  --color-primary-200: #BFDBFE;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --color-primary-700: #1D4ED8;
  
  /* Neutral - Gray */
  --color-gray-50: #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;
  
  /* Semantic Colors */
  --color-success-500: #10B981;
  --color-success-50: #ECFDF5;
  --color-warning-500: #F59E0B;
  --color-warning-50: #FFFBEB;
  --color-error-500: #EF4444;
  --color-error-50: #FEF2F2;
  
  /* Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9FAFB;
  --bg-tertiary: #F3F4F6;
  
  /* Borders */
  --border-default: #E5E7EB;
  --border-hover: #D1D5DB;
  --border-focus: #3B82F6;
}
```

**Border Radius:**

```css
:root {
  --radius-sm: 4px;      /* Buttons, inputs */
  --radius-md: 8px;      /* Cards, modals */
  --radius-lg: 12px;      /* Large cards, drawers */
  --radius-full: 9999px;  /* Pills, avatars */
}
```

**Shadows:**

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}
```

**Spacing Scale:**

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

**Typography:**

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
}
```

### Button Variants

| Variant | Usage | Style |
|---------|-------|-------|
| Primary | Main actions | Solid blue bg, white text |
| Secondary | Less important actions | Gray bg, dark text |
| Ghost | Tertiary actions, toolbars | Transparent, hover shows bg |
| Danger | Destructive actions | Red bg or red text |
| Link | Inline text actions | Underline on hover |

### Input Fields

```
┌─────────────────────────────────────────────────────┐
│ Label                                    [ℹ️ Help] │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Input placeholder                               │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Helper text or error message                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Input States:**
- Default: Gray-300 border
- Focus: Blue-500 border + ring
- Error: Red-500 border + red text
- Disabled: Gray-100 bg, gray-400 text

### Status Badges

| Status | Color | Usage |
|--------|-------|-------|
| Active/Running | Green-500 | Running servers, valid certs |
| Pending | Yellow-500 | In progress, processing |
| Error/Stopped | Red-500 | Failed, stopped services |
| Inactive | Gray-400 | Disabled, expired |
| Info | Blue-500 | Informational states |

---

## 7. Interaction Patterns

### Command Palette (Cmd+K)

**Trigger:** `Cmd+K` (Mac) / `Ctrl+K` (Windows)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                         🔍  Type a command or search...                 │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Recent                                                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 🏠  Go to Dashboard                                               │  │
│  │ 🌐  Go to Websites                                                 │  │
│  │ 💾  Create new Database                                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Actions                                                                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ ➕  Create new website                                             │  │
│  │ 📧  Add new domain                                                 │  │
│  │ ⚙️  Open settings                                                  │  │
│  │ 🌙  Toggle dark mode                                               │  │
│  │ 📚  View documentation                                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ↑↓  Navigate    ↵  Select    ⎋  Close                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Command Categories:**
- Navigation: "Go to [page]"
- Creation: "Create new [resource]"
- Actions: "Restart server", "Clear cache"
- Settings: "Toggle dark mode", "Open settings"
- Search: Fuzzy search across all resources

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `Cmd+N` | Create new resource (context-aware) |
| `Cmd+/` | Show shortcuts help |
| `Escape` | Close modal/drawer/go back |
| `Cmd+S` | Save current form |
| `Cmd+F` | Focus search |
| `G then D` | Go to Dashboard |
| `G then W` | Go to Websites |
| `G then S` | Go to Settings |

### Dropdown Menus

**Better Dropdown Design:**

```
Before (Current):          After (Improved):
┌──────────────────┐       ┌────────────────────────────────────┐
│ Actions ▼        │       │  example.com                    ⋮  │
└──────────────────┘       └────────────────────────────────────┘
                                  ┌────────────────────────────────┐
                                  │ ⚡ Quick Actions               │
                                  ├────────────────────────────────┤
                                  │ 📊 View Stats                  │
                                  │ 🔄 Restart                     │
                                  │ 🔧 Configure                   │
                                  ├────────────────────────────────┤
                                  │ 🖥  Open SSH                   │
                                  │ 📁 File Manager                │
                                  ├────────────────────────────────┤
                                  │ ⚠️  Delete Website             │  ← Red text for danger
                                  └────────────────────────────────┘
```

**Dropdown Features:**
- Keyboard navigation (arrow keys)
- Type-ahead search for long lists
- Grouped sections with headers
- Danger items at bottom with visual distinction
- Icons for each item
- Keyboard shortcut hints

### Toast Notifications

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ✓  Website created successfully                      [Dismiss] │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│                           [Auto-dismiss after 5s]                     │
└────────────────────────────────────────────────────────────────────────┘
```

**Toast Types:**
- Success (green icon)
- Error (red icon, persists until dismissed)
- Warning (yellow icon)
- Info (blue icon)

---

## 8. Loading & Empty States

### Skeleton Loaders

**Card Skeleton:**

```
┌─────────────────────────────────────────────────────────┐
│  ┌────┐                                                │
│  │    │  ████████████████                     [    ]  │
│  └────┘  ████████                                [    ]  │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ████████  ████████████     ████████████               │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  [████████████]                    [████████████]       │
│                                                         │
└─────────────────────────────────────────────────────────┘

Animation: Shimmer gradient moving left to right (1.5s loop)
```

**Table Skeleton:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────┬──────────────────────────┬──────────┬─────────┬───────────┐  │
│  │     │  ████████████████████    │ ████████ │ ████    │           │  │
│  ├─────┼──────────────────────────┼──────────┼─────────┼───────────┤  │
│  │     │  ████████████████████    │ ████████ │ ████    │           │  │
│  ├─────┼──────────────────────────┼──────────┼─────────┼───────────┤  │
│  │     │  ████████████████████    │ ████████ │ ████    │           │  │
│  └─────┴──────────────────────────┴──────────┴─────────┴───────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```tsx
// Skeleton component
<div className="animate-pulse">
  <div className="h-4 w-32 bg-gray-200 rounded"></div>
  <div className="h-3 w-48 bg-gray-100 rounded mt-2"></div>
</div>

// Shimmer overlay
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### Empty States

**Illustrated Empty State Template:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        ┌─────────────────┐                             │
│                        │                 │                             │
│                        │   [Illustration]│                             │
│                        │                 │                             │
│                        └─────────────────┘                             │
│                                                                         │
│                         No websites yet                                │
│                                                                         │
│                   Create your first website to get started.            │
│                   It only takes a few minutes.                         │
│                                                                         │
│                   ┌───────────────────────────────┐                    │
│                   │     + Create New Website      │                    │
│                   └───────────────────────────────┘                    │
│                                                                         │
│                   ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│                   │ 📚 Docs   │  │ 🎥 Video   │  │ 💬 Support │      │
│                   └────────────┘  └────────────┘  └────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Contextual Empty Messages:**

| Page | Message | CTA |
|------|---------|-----|
| Websites | "No websites yet. Host your first project." | "Create Website" |
| Databases | "No databases created. Store your application's data." | "Create Database" |
| Domains | "No domains connected. Add a domain to get started." | "Add Domain" |
| SSL | "No SSL certificates. Secure your websites." | "Add Certificate" |
| Files | "This folder is empty. Upload files to get started." | "Upload Files" |

### Error States

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        ┌─────────────────┐                             │
│                        │                 │                             │
│                        │       ⚠️        │                             │
│                        │                 │                             │
│                        └─────────────────┘                             │
│                                                                         │
│                         Failed to load websites                         │
│                                                                         │
│                   We couldn't load your websites. This might           │
│                   be a temporary issue. Try refreshing the page.       │
│                                                                         │
│                   ┌─────────────────┐  ┌─────────────────┐             │
│                   │   🔄 Retry      │  │  📧 Contact     │             │
│                   └─────────────────┘  └─────────────────┘             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Navigation Improvements

### Single Source of Truth for Breadcrumbs

**Current Problem:**
- Breadcrumbs appear in both top bar AND page header
- Duplication wastes space and creates confusion

**Solution:**
- Breadcrumbs ONLY in page header (left-aligned under top bar)
- Page header structure:

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  Page Header                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [Icon]  Page Title                               [Actions ▼]    │  │
│  │         Dashboard / Websites / example.com                      │  │
│  │         Optional description text                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Deep-linkable URL Structure

**URL Conventions:**

| Resource | URL Pattern | Example |
|----------|-------------|---------|
| List | `/{resource}` | `/websites` |
| Detail | `/{resource}/{id}` | `/websites/123` |
| Tab | `/{resource}/{id}/{tab}` | `/websites/123/ssl` |
| Action | `/{resource}/{id}/{tab}?action=edit` | `/websites/123/ssl?action=edit-record` |
| Create | `/{resource}/new` | `/websites/new` |
| Nested | `/{parent}/{id}/{child}` | `/websites/123/databases` |

**URL States:**
- Full bookmarkable (all state in URL)
- Browser back/forward works correctly
- Share URL = same view
- Deep linking to specific items

**Example URL States:**

```
# Default list view
https://panel.example.com/websites

# Filtered list
https://panel.example.com/websites?status=running&sort=name

# Specific item detail
https://panel.example.com/websites/abc123

# Specific item, specific tab
https://panel.example.com/websites/abc123/ssl

# Specific item, tab, action modal
https://panel.example.com/websites/abc123/ssl?modal=add-record
```

### Navigation Behavior

| Action | Behavior |
|--------|----------|
| Click breadcrumb | Navigate to that level |
| Click page title | Navigate to parent list (if in detail view) |
| Browser back | Previous URL state |
| Browser forward | Next URL state |
| Direct URL access | Load appropriate view |

---

## 10. Implementation Phases

### Phase 1: Quick Wins (Week 1-2)

**Goal:** Immediate visual improvement with minimal risk

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Add skeleton loaders to all list pages | Low | High | `apps/web/src/components/ui/Skeleton.tsx` |
| Create illustrated empty state component | Low | Medium | `apps/web/src/components/ui/EmptyState.tsx` |
| Add command palette (basic) | Medium | High | `apps/web/src/components/CommandPalette.tsx` |
| Standardize button styles | Low | Medium | `apps/web/src/index.css` |
| Add loading spinners to all actions | Low | Medium | Global |

### Phase 2: Layout Foundation (Week 3-4)

**Goal:** Establish new layout system

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Implement collapsible sidebar | Medium | High | `apps/web/src/components/layout/Sidebar.tsx` |
| Redesign top bar | Medium | Medium | `apps/web/src/components/layout/TopBar.tsx` |
| Remove duplicate breadcrumbs | Low | Low | `apps/web/src/components/layout/*` |
| Add design tokens (CSS variables) | Medium | High | `apps/web/src/index.css` |
| Create component library | High | High | `apps/web/src/components/ui/*` |

### Phase 3: Card Grid Migration (Week 5-8)

**Goal:** Replace tables with card grids where appropriate

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Migrate Websites list to cards | Medium | High | `apps/web/src/pages/websites/*` |
| Migrate Databases list to cards | Medium | Medium | `apps/web/src/pages/databases/*` |
| Migrate Domains list to cards | Medium | Medium | `apps/web/src/pages/domains/*` |
| Migrate SSL list to cards | Medium | Low | `apps/web/src/pages/ssl/*` |
| Keep DNS records as table | Low | Low | `apps/web/src/pages/dns/*` |

### Phase 4: Detail Page Patterns (Week 9-10)

**Goal:** Implement drawer and route-based detail patterns

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Implement slide-over drawer component | Medium | High | `apps/web/src/components/ui/Drawer.tsx` |
| Convert quick views to drawers | Medium | Medium | Various pages |
| Implement tabbed detail pages | Medium | Medium | `apps/web/src/pages/websites/*` |
| Add URL state persistence | Medium | High | `apps/web/src/router.tsx` |

### Phase 5: Wizard Flows (Week 11-14)

**Goal:** Replace massive forms with step-by-step wizards

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Create Wizard component | Medium | High | `apps/web/src/components/ui/Wizard.tsx` |
| Website creation wizard | High | High | `apps/web/src/pages/websites/*` |
| Domain addition wizard | Medium | Medium | `apps/web/src/pages/domains/*` |
| Database creation wizard | Medium | Medium | `apps/web/src/pages/databases/*` |
| SSL creation wizard | Medium | Low | `apps/web/src/pages/ssl/*` |

### Phase 6: Polish & Interaction (Week 15-16)

**Goal:** Add finishing touches and interaction improvements

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Implement keyboard shortcuts | Medium | Medium | Global |
| Add dropdown improvements | Medium | Medium | `apps/web/src/components/ui/Dropdown.tsx` |
| Improve toast notifications | Low | Medium | `apps/web/src/lib/toast.ts` |
| Add micro-interactions | Low | Low | Various |
| Dark mode support | High | Medium | `apps/web/src/index.css` |

### Phase 7: Testing & Refinement (Week 17-18)

**Goal:** Ensure quality and gather feedback

| Task | Effort | Impact | Files |
|------|--------|--------|-------|
| Cross-browser testing | Medium | High | - |
| Mobile responsiveness check | Medium | High | - |
| A11y audit (WCAG 2.1) | Medium | High | - |
| Performance audit | Medium | Medium | - |
| User testing feedback | High | High | - |
| Iterate on feedback | Varies | High | Various |

---

## Component Priority Matrix

```
        Low Effort                      High Effort
        ┌───────────────────────────────┐
High    │ • Skeleton loaders             │ • Card grids
Impact  │ • Empty states                 │ • Sidebar redesign
        │ • Design tokens               │ • Wizard flows
        │ • Toast improvements           │ • Detail page routes
        ├───────────────────────────────┤
Low     │ • Button styles               │ • Full component library
Impact  │ • Remove duplicate bcrumbs    │ • Command palette
        │ • Loading spinners            │ • Keyboard shortcuts
        └───────────────────────────────┘
```

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| First Contentful Paint | ~2s | <1s | Lighthouse |
| Time to Interactive | ~5s | <2s | Lighthouse |
| User task completion (create website) | ~60s | <30s | User testing |
| Error rate on forms | ~15% | <5% | Analytics |
| NPS (if available) | ? | +20 | Survey |
| Support tickets for UI confusion | ? | -50% | Support data |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing user workflows | Medium | High | Gradual rollout, user testing |
| Inconsistent implementation | Medium | Medium | Component library, design tokens |
| Performance regression | Low | High | Lighthouse CI, performance budgets |
| Scope creep | High | Medium | Strict phase gates, prioritize |
| Backend API changes needed | Medium | Medium | Coordinate with API team |

---

## References

- [Vercel Dashboard](https://vercel.com/dashboard) - Layout and card design
- [Linear](https://linear.app) - Keyboard shortcuts, command palette
- [Railway](https://railway.app) - Wizard flows, empty states
- [Planetscale](https://planetscale.com) - Table design, dark mode
- [Tailwind UI](https://tailwindui.com) - Component patterns
- [Radix UI](https://radix-ui.com) - Accessible primitives
- [shadcn/ui](https://ui.shadcn.com) - Implementation reference

---

## Appendix: File Structure Changes

```
apps/web/src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Drawer.tsx
│   │   ├── Dropdown.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Select.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Table.tsx (deprecated, use Card)
│   │   ├── Tabs.tsx
│   │   ├── Toast.tsx
│   │   └── Wizard.tsx
│   ├── CommandPalette.tsx
│   ├── layout/
│   │   ├── AppLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   └── ...
├── hooks/
│   ├── useCommandPalette.ts
│   ├── useKeyboardShortcuts.ts
│   └── ...
├── pages/
│   ├── websites/
│   │   ├── WebsitesPage.tsx (card grid)
│   │   ├── WebsiteDetailPage.tsx (tabs)
│   │   └── WebsiteCreatePage.tsx (wizard)
│   └── ...
└── styles/
    └── tokens.css (design tokens)