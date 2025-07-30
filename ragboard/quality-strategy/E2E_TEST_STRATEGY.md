# E2E Testing Strategy with Playwright

## Overview

End-to-end testing ensures RAGBOARD works correctly from a user's perspective, testing complete user journeys across the full stack.

## Playwright Configuration

### Project Structure

```
ragboard/
├── e2e/
│   ├── fixtures/
│   │   ├── auth.fixture.ts
│   │   ├── board.fixture.ts
│   │   └── test-data.fixture.ts
│   ├── pages/
│   │   ├── login.page.ts
│   │   ├── board.page.ts
│   │   ├── chat.page.ts
│   │   └── base.page.ts
│   ├── tests/
│   │   ├── auth/
│   │   │   ├── login.spec.ts
│   │   │   └── registration.spec.ts
│   │   ├── board/
│   │   │   ├── create-board.spec.ts
│   │   │   ├── collaboration.spec.ts
│   │   │   └── node-interactions.spec.ts
│   │   ├── ai-chat/
│   │   │   ├── chat-flow.spec.ts
│   │   │   └── rag-search.spec.ts
│   │   └── critical-paths/
│   │       ├── onboarding.spec.ts
│   │       └── document-processing.spec.ts
│   ├── utils/
│   │   ├── helpers.ts
│   │   └── test-api.ts
│   └── global-setup.ts
├── playwright.config.ts
└── .env.test
```

### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }],
    ['list'],
  ],
  
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev:test',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
```

## Page Object Model

### Base Page

```typescript
// e2e/pages/base.page.ts
import { Page, Locator } from '@playwright/test'

export class BasePage {
  protected page: Page

  constructor(page: Page) {
    this.page = page
  }

  async navigate(path: string) {
    await this.page.goto(path)
  }

  async waitForLoadComplete() {
    await this.page.waitForLoadState('networkidle')
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `screenshots/${name}.png`,
      fullPage: true 
    })
  }

  async waitForToast(message: string) {
    await this.page.waitForSelector(
      `[role="status"]:has-text("${message}")`,
      { timeout: 5000 }
    )
  }

  async dismissToast() {
    const toast = this.page.locator('[role="status"]')
    const closeButton = toast.locator('button[aria-label="Close"]')
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }
  }
}
```

### Board Page

```typescript
// e2e/pages/board.page.ts
import { Page, Locator } from '@playwright/test'
import { BasePage } from './base.page'

export class BoardPage extends BasePage {
  readonly canvas: Locator
  readonly addNodeButton: Locator
  readonly searchInput: Locator
  readonly aiChatPanel: Locator
  readonly collaboratorsList: Locator

  constructor(page: Page) {
    super(page)
    this.canvas = page.locator('[data-testid="board-canvas"]')
    this.addNodeButton = page.locator('[data-testid="add-node-button"]')
    this.searchInput = page.locator('[placeholder="Search..."]')
    this.aiChatPanel = page.locator('[data-testid="ai-chat-panel"]')
    this.collaboratorsList = page.locator('[data-testid="collaborators-list"]')
  }

  async createTextNode(text: string, position = { x: 100, y: 100 }) {
    await this.addNodeButton.click()
    await this.page.click('[data-testid="node-type-text"]')
    
    // Click on canvas to place node
    await this.canvas.click({ position })
    
    // Type in the text node
    const textInput = this.page.locator(
      '[data-testid="text-node-input"]:last-child'
    )
    await textInput.fill(text)
    await this.page.keyboard.press('Escape')
  }

  async uploadFile(filePath: string) {
    await this.addNodeButton.click()
    await this.page.click('[data-testid="node-type-file"]')
    
    const fileInput = this.page.locator('input[type="file"]')
    await fileInput.setInputFiles(filePath)
    
    // Wait for upload to complete
    await this.page.waitForSelector(
      '[data-testid="upload-complete"]',
      { timeout: 30000 }
    )
  }

  async connectNodes(sourceId: string, targetId: string) {
    const sourceNode = this.page.locator(`[data-nodeid="${sourceId}"]`)
    const targetNode = this.page.locator(`[data-nodeid="${targetId}"]`)
    
    // Drag from source handle to target handle
    const sourceHandle = sourceNode.locator('.source-handle')
    const targetHandle = targetNode.locator('.target-handle')
    
    await sourceHandle.dragTo(targetHandle)
  }

  async searchBoard(query: string) {
    await this.searchInput.fill(query)
    await this.page.keyboard.press('Enter')
    await this.page.waitForSelector('[data-testid="search-results"]')
  }

  async openAIChat() {
    const chatButton = this.page.locator('[data-testid="ai-chat-button"]')
    await chatButton.click()
    await this.aiChatPanel.waitFor({ state: 'visible' })
  }

  async sendAIChatMessage(message: string) {
    const chatInput = this.aiChatPanel.locator('textarea')
    await chatInput.fill(message)
    
    const sendButton = this.aiChatPanel.locator(
      'button[aria-label="Send message"]'
    )
    await sendButton.click()
    
    // Wait for response
    await this.page.waitForSelector(
      '[data-testid="ai-response"]:last-child',
      { timeout: 30000 }
    )
  }

  async getNodeCount(): Promise<number> {
    const nodes = await this.page.locator('[data-testid^="node-"]').all()
    return nodes.length
  }

  async selectNode(nodeId: string) {
    await this.page.click(`[data-nodeid="${nodeId}"]`)
  }

  async deleteSelectedNode() {
    await this.page.keyboard.press('Delete')
    await this.waitForToast('Node deleted')
  }
}
```

## Test Fixtures

### Authentication Fixture

```typescript
// e2e/fixtures/auth.fixture.ts
import { test as base } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { createTestUser, deleteTestUser } from '../utils/test-api'

type AuthFixtures = {
  authenticatedPage: Page
  testUser: {
    email: string
    password: string
    id: string
  }
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    // Create test user via API
    const user = await createTestUser()
    
    await use(user)
    
    // Cleanup
    await deleteTestUser(user.id)
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Login before each test
    const loginPage = new LoginPage(page)
    await loginPage.navigate('/')
    await loginPage.login(testUser.email, testUser.password)
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard')
    
    await use(page)
  },
})
```

## Test Scenarios

### Critical Path Tests

```typescript
// e2e/tests/critical-paths/onboarding.spec.ts
import { test, expect } from '@playwright/test'
import { BoardPage } from '../../pages/board.page'

test.describe('User Onboarding Flow', () => {
  test('new user can complete onboarding', async ({ page }) => {
    // 1. Visit landing page
    await page.goto('/')
    
    // 2. Click get started
    await page.click('text=Get Started')
    
    // 3. Fill registration form
    await page.fill('[name="email"]', 'newuser@example.com')
    await page.fill('[name="password"]', 'SecurePass123!')
    await page.fill('[name="confirmPassword"]', 'SecurePass123!')
    await page.click('button[type="submit"]')
    
    // 4. Verify email step
    await expect(page).toHaveURL('/verify-email')
    await expect(page.locator('text=Check your email')).toBeVisible()
    
    // 5. Simulate email verification (in test mode)
    await page.goto('/verify-email?token=test-token')
    
    // 6. Complete profile
    await page.fill('[name="displayName"]', 'Test User')
    await page.selectOption('[name="role"]', 'researcher')
    await page.click('text=Complete Setup')
    
    // 7. See welcome tutorial
    await expect(page.locator('[data-testid="tutorial-overlay"]')).toBeVisible()
    await page.click('text=Skip Tutorial')
    
    // 8. Land on dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Welcome, Test User')).toBeVisible()
  })
})
```

### Board Collaboration Tests

```typescript
// e2e/tests/board/collaboration.spec.ts
import { test, expect } from '../../fixtures/auth.fixture'
import { BoardPage } from '../../pages/board.page'

test.describe('Real-time Collaboration', () => {
  test('multiple users can collaborate on a board', async ({ 
    browser, 
    authenticatedPage: page1,
    testUser 
  }) => {
    // User 1 creates a board
    const boardPage1 = new BoardPage(page1)
    await page1.goto('/boards/new')
    await page1.fill('[name="boardTitle"]', 'Collaboration Test Board')
    await page1.click('text=Create Board')
    
    const boardUrl = page1.url()
    const boardId = boardUrl.split('/').pop()
    
    // User 2 joins the board
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    const user2 = await createTestUser()
    
    const loginPage2 = new LoginPage(page2)
    await loginPage2.navigate('/')
    await loginPage2.login(user2.email, user2.password)
    
    await page2.goto(boardUrl)
    const boardPage2 = new BoardPage(page2)
    
    // User 1 creates a node
    await boardPage1.createTextNode('User 1 was here', { x: 100, y: 100 })
    
    // User 2 should see the node appear
    await expect(page2.locator('text=User 1 was here')).toBeVisible({
      timeout: 5000
    })
    
    // User 2 creates a node
    await boardPage2.createTextNode('User 2 was here', { x: 300, y: 100 })
    
    // User 1 should see User 2's node
    await expect(page1.locator('text=User 2 was here')).toBeVisible({
      timeout: 5000
    })
    
    // Check presence indicators
    const collaborators1 = boardPage1.collaboratorsList
    await expect(collaborators1).toContainText(user2.email)
    
    const collaborators2 = boardPage2.collaboratorsList
    await expect(collaborators2).toContainText(testUser.email)
    
    // Cleanup
    await context2.close()
    await deleteTestUser(user2.id)
  })

  test('cursor tracking works across users', async ({ 
    browser, 
    authenticatedPage: page1 
  }) => {
    // Setup two users on same board
    const boardPage1 = new BoardPage(page1)
    await boardPage1.navigate('/boards/shared-test-board')
    
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    // ... login user 2 ...
    
    const boardPage2 = new BoardPage(page2)
    await boardPage2.navigate('/boards/shared-test-board')
    
    // User 1 moves cursor
    await page1.mouse.move(200, 200)
    
    // User 2 should see User 1's cursor
    const user1Cursor = page2.locator('[data-testid="remote-cursor-user1"]')
    await expect(user1Cursor).toBeVisible()
    
    // Verify cursor position
    const cursorBox = await user1Cursor.boundingBox()
    expect(cursorBox?.x).toBeCloseTo(200, 10)
    expect(cursorBox?.y).toBeCloseTo(200, 10)
    
    await context2.close()
  })
})
```

### AI Chat Integration Tests

```typescript
// e2e/tests/ai-chat/rag-search.spec.ts
import { test, expect } from '../../fixtures/auth.fixture'
import { BoardPage } from '../../pages/board.page'
import path from 'path'

test.describe('AI Chat with RAG', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    const boardPage = new BoardPage(authenticatedPage)
    await boardPage.navigate('/boards/new')
  })

  test('AI can search uploaded documents', async ({ authenticatedPage }) => {
    const boardPage = new BoardPage(authenticatedPage)
    
    // Upload a test document
    const testFile = path.join(__dirname, '../../fixtures/test-document.pdf')
    await boardPage.uploadFile(testFile)
    
    // Wait for processing
    await authenticatedPage.waitForSelector(
      'text=Document processed successfully',
      { timeout: 60000 }
    )
    
    // Open AI chat
    await boardPage.openAIChat()
    
    // Ask about document content
    await boardPage.sendAIChatMessage(
      'What is the main topic of the uploaded document?'
    )
    
    // Verify AI response references the document
    const response = authenticatedPage.locator(
      '[data-testid="ai-response"]:last-child'
    )
    await expect(response).toContainText('document')
    await expect(response).toContainText('test-document.pdf')
  })

  test('AI provides contextual suggestions', async ({ authenticatedPage }) => {
    const boardPage = new BoardPage(authenticatedPage)
    
    // Create some nodes
    await boardPage.createTextNode('Machine Learning Research')
    await boardPage.createTextNode('Neural Networks')
    await boardPage.createTextNode('Deep Learning Applications')
    
    // Open AI chat
    await boardPage.openAIChat()
    
    // Ask for suggestions
    await boardPage.sendAIChatMessage(
      'Based on my board content, what related topics should I explore?'
    )
    
    // Verify AI provides relevant suggestions
    const response = authenticatedPage.locator(
      '[data-testid="ai-response"]:last-child'
    )
    
    // Should mention related ML topics
    const responseText = await response.textContent()
    expect(responseText).toMatch(
      /transformer|reinforcement|computer vision|nlp/i
    )
  })
})
```

### Performance Tests

```typescript
// e2e/tests/performance/load-time.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Performance Tests', () => {
  test('board loads within performance budget', async ({ page }) => {
    // Start performance measurement
    await page.goto('/boards/large-test-board', {
      waitUntil: 'networkidle'
    })
    
    // Measure performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      }
    })
    
    // Assert performance budgets
    expect(metrics.firstContentfulPaint).toBeLessThan(1500) // 1.5s
    expect(metrics.domContentLoaded).toBeLessThan(3000) // 3s
    expect(metrics.loadComplete).toBeLessThan(5000) // 5s
  })

  test('search responds quickly with large dataset', async ({ page }) => {
    await page.goto('/boards/large-test-board')
    const boardPage = new BoardPage(page)
    
    // Measure search performance
    const startTime = Date.now()
    await boardPage.searchBoard('test query')
    const searchTime = Date.now() - startTime
    
    // Search should complete within 500ms
    expect(searchTime).toBeLessThan(500)
    
    // Results should be visible
    const results = page.locator('[data-testid="search-results"]')
    await expect(results).toBeVisible()
    const resultCount = await results.locator('.search-result-item').count()
    expect(resultCount).toBeGreaterThan(0)
  })
})
```

### Accessibility Tests

```typescript
// e2e/tests/accessibility/a11y.spec.ts
import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await injectAxe(page)
  })

  test('board page has no accessibility violations', async ({ page }) => {
    await page.goto('/boards/test-board')
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    })
  })

  test('keyboard navigation works correctly', async ({ page }) => {
    await page.goto('/boards/test-board')
    
    // Tab through interactive elements
    await page.keyboard.press('Tab')
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement).toBe('BUTTON') // Skip to content
    
    await page.keyboard.press('Tab')
    focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    expect(focusedElement).toBe('search-input')
    
    // Test keyboard shortcuts
    await page.keyboard.press('Control+K')
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible()
    
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible()
  })

  test('screen reader announcements work', async ({ page }) => {
    await page.goto('/boards/test-board')
    
    // Create a node and verify announcement
    await page.click('[data-testid="add-node-button"]')
    
    const announcement = await page.locator('[role="status"][aria-live="polite"]')
    await expect(announcement).toContainText('Node menu opened')
    
    await page.click('[data-testid="node-type-text"]')
    await expect(announcement).toContainText('Text node selected')
  })
})
```

## Test Data Management

### Test API Utilities

```typescript
// e2e/utils/test-api.ts
import axios from 'axios'

const API_URL = process.env.API_URL || 'http://localhost:8000'

export async function createTestUser() {
  const response = await axios.post(`${API_URL}/api/test/users`, {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPass123!',
  })
  return response.data
}

export async function deleteTestUser(userId: string) {
  await axios.delete(`${API_URL}/api/test/users/${userId}`)
}

export async function createTestBoard(userId: string, data: any) {
  const response = await axios.post(
    `${API_URL}/api/test/boards`,
    data,
    {
      headers: {
        'X-Test-User-Id': userId,
      },
    }
  )
  return response.data
}

export async function seedTestData(scenario: string) {
  await axios.post(`${API_URL}/api/test/seed`, { scenario })
}
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
        
      - name: Start services
        run: |
          docker-compose -f docker-compose.test.yml up -d
          npm run wait-for-services
          
      - name: Run E2E tests
        run: |
          npx playwright test --shard=${{ matrix.shard }}/4
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:5173
          API_URL: http://localhost:8000
          
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/
          
      - name: Upload videos
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-videos-${{ matrix.shard }}
          path: test-results/
```

## Visual Regression Testing

```typescript
// e2e/tests/visual/visual-regression.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Visual Regression Tests', () => {
  test('board layout remains consistent', async ({ page }) => {
    await page.goto('/boards/visual-test-board')
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveScreenshot('board-layout.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [page.locator('[data-testid="timestamp"]')],
    })
  })

  test('AI chat panel appearance', async ({ page }) => {
    await page.goto('/boards/test-board')
    await page.click('[data-testid="ai-chat-button"]')
    
    const chatPanel = page.locator('[data-testid="ai-chat-panel"]')
    await expect(chatPanel).toHaveScreenshot('ai-chat-panel.png')
  })

  test('dark mode consistency', async ({ page }) => {
    await page.goto('/boards/test-board')
    
    // Enable dark mode
    await page.click('[data-testid="theme-toggle"]')
    await page.waitForTimeout(500) // Wait for transition
    
    await expect(page).toHaveScreenshot('board-dark-mode.png', {
      fullPage: true,
    })
  })
})
```

## Best Practices

1. **Test Independence**: Each test should be able to run in isolation
2. **Proper Cleanup**: Always clean up test data after tests
3. **Reliable Selectors**: Use data-testid attributes for stability
4. **Parallel Execution**: Design tests to run in parallel
5. **Flake Prevention**: Use proper waits and avoid arbitrary delays
6. **Meaningful Assertions**: Test user-visible behavior
7. **Cross-browser Testing**: Test on all supported browsers
8. **Mobile Testing**: Include mobile viewport tests
9. **Performance Monitoring**: Track test execution time
10. **Debugging Support**: Enable trace and video on failure