# PostHog Analytics Integration Guide for RAGBOARD

## Overview
Integrate PostHog for self-hosted product analytics, user behavior tracking, and feature flags. This enables data-driven decisions while maintaining user privacy.

## Installation

### Frontend Setup
```bash
npm install posthog-js
```

### Backend Setup (for self-hosted)
```bash
# Using Docker
docker run -d \
  --name posthog \
  -p 8000:8000 \
  -v posthog-data:/var/lib/postgresql/12/main \
  posthog/posthog:latest
```

## Implementation Steps

### 1. PostHog Provider (src/providers/PostHogProvider.tsx)

```typescript
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { useAuth } from '../contexts/AuthContext';

interface PostHogProviderProps {
  children: React.ReactNode;
  apiKey: string;
  apiHost?: string; // For self-hosted instances
}

export function PostHogProvider({ 
  children, 
  apiKey, 
  apiHost = 'https://app.posthog.com' 
}: PostHogProviderProps) {
  const { user } = useAuth();

  useEffect(() => {
    // Initialize PostHog
    posthog.init(apiKey, {
      api_host: apiHost,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage',
      autocapture: {
        dom_event_allowlist: ['click', 'submit', 'change'],
        css_selector_allowlist: [
          '[data-track]',
          '.track-click',
          'button',
          'a',
          'input[type="submit"]',
        ],
      },
      // Privacy settings
      mask_all_text: false,
      mask_all_element_attributes: false,
      // Performance settings
      capture_performance: true,
      // Session recording (optional)
      enable_recording_console_log: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '.sensitive-data',
      },
    });

    // Opt-out handling
    if (localStorage.getItem('posthog_opt_out') === 'true') {
      posthog.opt_out_capturing();
    }
  }, [apiKey, apiHost]);

  useEffect(() => {
    // Identify user when they log in
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        subscription_plan: user.subscription?.plan,
        created_at: user.createdAt,
        organization_id: user.organizationId,
      });

      // Set user properties
      posthog.people.set({
        $email: user.email,
        $name: user.name,
        subscription_plan: user.subscription?.plan,
        total_boards: user.boardCount,
      });
    } else {
      // Reset on logout
      posthog.reset();
    }
  }, [user]);

  return <>{children}</>;
}
```

### 2. Analytics Hook (src/hooks/useAnalytics.ts)

```typescript
import { useCallback } from 'react';
import posthog from 'posthog-js';

interface TrackingOptions {
  timestamp?: Date;
  context?: Record<string, any>;
  send_instantly?: boolean;
}

export function useAnalytics() {
  const track = useCallback((
    eventName: string,
    properties?: Record<string, any>,
    options?: TrackingOptions
  ) => {
    posthog.capture(eventName, {
      ...properties,
      timestamp: options?.timestamp,
      $set: options?.context,
    }, {
      send_instantly: options?.send_instantly,
    });
  }, []);

  const trackTiming = useCallback((
    category: string,
    variable: string,
    value: number,
    label?: string
  ) => {
    posthog.capture('timing_complete', {
      category,
      variable,
      value,
      label,
    });
  }, []);

  const setUserProperty = useCallback((
    property: string | Record<string, any>,
    value?: any
  ) => {
    if (typeof property === 'string') {
      posthog.people.set({ [property]: value });
    } else {
      posthog.people.set(property);
    }
  }, []);

  const incrementUserProperty = useCallback((
    property: string,
    value: number = 1
  ) => {
    posthog.people.increment(property, value);
  }, []);

  return {
    track,
    trackTiming,
    setUserProperty,
    incrementUserProperty,
    posthog, // Direct access for advanced usage
  };
}
```

### 3. Board Analytics Tracking (src/components/BoardCanvas.tsx)

```typescript
import { useAnalytics } from '../hooks/useAnalytics';
import { useEffect, useRef } from 'react';

export function BoardCanvasWithAnalytics() {
  const { track, trackTiming } = useAnalytics();
  const loadTimeRef = useRef(Date.now());
  
  // Track board load time
  useEffect(() => {
    const loadTime = Date.now() - loadTimeRef.current;
    trackTiming('board', 'load_time', loadTime);
  }, []);

  // Track node operations
  const handleNodeAdd = (nodeType: string) => {
    track('node_added', {
      node_type: nodeType,
      board_id: boardId,
      total_nodes: nodes.length + 1,
    });
  };

  const handleNodeDelete = (nodeId: string, nodeType: string) => {
    track('node_deleted', {
      node_type: nodeType,
      board_id: boardId,
      total_nodes: nodes.length - 1,
    });
  };

  // Track collaboration events
  const handleCollaboratorJoin = (userId: string) => {
    track('collaborator_joined', {
      board_id: boardId,
      collaborator_id: userId,
      total_collaborators: collaborators.length,
    });
  };

  // Track performance metrics
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          trackTiming('performance', entry.name, entry.duration);
        }
      }
    });

    observer.observe({ entryTypes: ['measure'] });
    return () => observer.disconnect();
  }, []);

  return (
    <BoardCanvas
      onNodeAdd={handleNodeAdd}
      onNodeDelete={handleNodeDelete}
      // ... other props
    />
  );
}
```

### 4. Feature Flags Integration (src/hooks/useFeatureFlag.ts)

```typescript
import { useEffect, useState } from 'react';
import posthog from 'posthog-js';

export function useFeatureFlag(flagName: string, defaultValue = false): boolean {
  const [isEnabled, setIsEnabled] = useState(defaultValue);

  useEffect(() => {
    // Check if feature flag is enabled
    const checkFlag = () => {
      const flagValue = posthog.isFeatureEnabled(flagName);
      setIsEnabled(flagValue ?? defaultValue);
    };

    // Initial check
    checkFlag();

    // Listen for flag updates
    posthog.onFeatureFlags(checkFlag);
  }, [flagName, defaultValue]);

  return isEnabled;
}

// Usage example
export function ExperimentalFeature() {
  const isNewUIEnabled = useFeatureFlag('new-ui-design');
  const isCollabEnabled = useFeatureFlag('realtime-collaboration', true);

  if (!isNewUIEnabled) {
    return <OldUIComponent />;
  }

  return <NewUIComponent collaborative={isCollabEnabled} />;
}
```

### 5. User Behavior Tracking (src/components/TrackedComponents.tsx)

```typescript
// Wrapper component for tracking interactions
export function TrackedButton({ 
  eventName, 
  eventProperties, 
  children, 
  ...props 
}: ButtonProps & { 
  eventName: string; 
  eventProperties?: Record<string, any>;
}) {
  const { track } = useAnalytics();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    track(eventName, eventProperties);
    props.onClick?.(e);
  };

  return (
    <button {...props} onClick={handleClick} data-track={eventName}>
      {children}
    </button>
  );
}

// Export tracking
export function ExportButton() {
  return (
    <TrackedButton
      eventName="export_initiated"
      eventProperties={{ format: 'png' }}
      className="export-button"
    >
      Export as PNG
    </TrackedButton>
  );
}
```

### 6. Funnel Tracking (src/hooks/useFunnelTracking.ts)

```typescript
export function useFunnelTracking(funnelName: string) {
  const { track } = useAnalytics();
  const stepsRef = useRef<Set<string>>(new Set());

  const trackStep = useCallback((
    step: string,
    properties?: Record<string, any>
  ) => {
    stepsRef.current.add(step);
    
    track(`${funnelName}_${step}`, {
      ...properties,
      funnel: funnelName,
      step_number: stepsRef.current.size,
      previous_steps: Array.from(stepsRef.current),
    });
  }, [funnelName, track]);

  const completeFunnel = useCallback((
    properties?: Record<string, any>
  ) => {
    track(`${funnelName}_completed`, {
      ...properties,
      funnel: funnelName,
      total_steps: stepsRef.current.size,
      all_steps: Array.from(stepsRef.current),
    });
  }, [funnelName, track]);

  return { trackStep, completeFunnel };
}

// Usage in onboarding
export function OnboardingFlow() {
  const { trackStep, completeFunnel } = useFunnelTracking('onboarding');

  const handleCreateBoard = () => {
    trackStep('board_created');
  };

  const handleAddFirstNode = () => {
    trackStep('first_node_added');
  };

  const handleInviteCollaborator = () => {
    trackStep('collaborator_invited');
    completeFunnel({ time_to_complete: Date.now() - startTime });
  };
}
```

### 7. Backend Integration (backend/app/services/analytics.py)

```python
from posthog import Posthog
from app.core.config import settings
import asyncio

class AnalyticsService:
    def __init__(self):
        self.posthog = Posthog(
            settings.POSTHOG_API_KEY,
            host=settings.POSTHOG_HOST
        )
    
    async def track_event(
        self,
        user_id: str,
        event: str,
        properties: dict = None
    ):
        """Track user events from backend"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self.posthog.capture,
            user_id,
            event,
            properties or {}
        )
    
    async def track_api_usage(
        self,
        user_id: str,
        endpoint: str,
        method: str,
        response_time: float,
        status_code: int
    ):
        """Track API endpoint usage"""
        await self.track_event(
            user_id,
            'api_request',
            {
                'endpoint': endpoint,
                'method': method,
                'response_time_ms': response_time * 1000,
                'status_code': status_code,
                'success': 200 <= status_code < 300
            }
        )
    
    async def track_ai_usage(
        self,
        user_id: str,
        model: str,
        tokens: int,
        cost: float,
        duration: float
    ):
        """Track AI model usage for cost optimization"""
        await self.track_event(
            user_id,
            'ai_model_used',
            {
                'model': model,
                'tokens': tokens,
                'cost_usd': cost,
                'duration_ms': duration * 1000,
                'tokens_per_second': tokens / duration if duration > 0 else 0
            }
        )

# FastAPI middleware
from fastapi import Request
import time

async def analytics_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    if hasattr(request.state, "user"):
        await analytics_service.track_api_usage(
            user_id=request.state.user.id,
            endpoint=request.url.path,
            method=request.method,
            response_time=duration,
            status_code=response.status_code
        )
    
    return response
```

### 8. Custom Dashboards (src/components/AnalyticsDashboard.tsx)

```typescript
import { useEffect, useState } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    // Fetch aggregated metrics from PostHog API
    fetchMetrics();
  }, []);

  return (
    <div className="analytics-dashboard p-6">
      <h2 className="text-2xl font-bold mb-6">Usage Analytics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Active Users */}
        <MetricCard
          title="Active Users"
          value={metrics?.activeUsers || 0}
          change={metrics?.userGrowth || 0}
          timeframe="Last 30 days"
        />
        
        {/* Board Creation */}
        <MetricCard
          title="Boards Created"
          value={metrics?.boardsCreated || 0}
          change={metrics?.boardGrowth || 0}
          timeframe="Last 30 days"
        />
        
        {/* Feature Usage */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-4">Feature Usage</h3>
          <Pie
            data={{
              labels: ['Export', 'Voice Notes', 'Collaboration', 'AI Chat'],
              datasets: [{
                data: [45, 25, 20, 10],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
              }],
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

### 9. A/B Testing Framework (src/hooks/useABTest.ts)

```typescript
import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { useAnalytics } from './useAnalytics';

export function useABTest<T extends string>(
  experimentName: string,
  variants: T[],
  defaultVariant: T
): {
  variant: T;
  trackConversion: (value?: number) => void;
} {
  const [variant, setVariant] = useState<T>(defaultVariant);
  const { track } = useAnalytics();

  useEffect(() => {
    // Get experiment variant from PostHog
    const experimentVariant = posthog.getFeatureFlag(experimentName) as T;
    
    if (experimentVariant && variants.includes(experimentVariant)) {
      setVariant(experimentVariant);
      track(`experiment_exposed`, {
        experiment: experimentName,
        variant: experimentVariant,
      });
    }
  }, [experimentName, variants]);

  const trackConversion = useCallback((value?: number) => {
    track(`experiment_conversion`, {
      experiment: experimentName,
      variant,
      value,
    });
  }, [experimentName, variant, track]);

  return { variant, trackConversion };
}

// Usage
export function PricingPage() {
  const { variant, trackConversion } = useABTest(
    'pricing_page_layout',
    ['control', 'variant_a', 'variant_b'],
    'control'
  );

  const handleSubscribe = () => {
    trackConversion(29.99); // Track with revenue value
    // Subscribe logic
  };

  switch (variant) {
    case 'variant_a':
      return <PricingLayoutA onSubscribe={handleSubscribe} />;
    case 'variant_b':
      return <PricingLayoutB onSubscribe={handleSubscribe} />;
    default:
      return <PricingLayoutDefault onSubscribe={handleSubscribe} />;
  }
}
```

### 10. Privacy Controls (src/components/PrivacySettings.tsx)

```typescript
export function PrivacySettings() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(
    localStorage.getItem('posthog_opt_out') !== 'true'
  );

  const handleToggleAnalytics = (enabled: boolean) => {
    if (enabled) {
      posthog.opt_in_capturing();
      localStorage.removeItem('posthog_opt_out');
    } else {
      posthog.opt_out_capturing();
      localStorage.setItem('posthog_opt_out', 'true');
    }
    setAnalyticsEnabled(enabled);
  };

  return (
    <div className="privacy-settings">
      <h3>Privacy Settings</h3>
      
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={analyticsEnabled}
          onChange={(e) => handleToggleAnalytics(e.target.checked)}
        />
        <span>
          Allow analytics to improve your experience
        </span>
      </label>
      
      <p className="text-sm text-gray-600 mt-2">
        We use PostHog to understand how you use Ragboard. 
        Your data never leaves our servers.
      </p>
      
      <button
        onClick={() => posthog.capture('$delete_person')}
        className="text-red-600 text-sm mt-4"
      >
        Delete all my analytics data
      </button>
    </div>
  );
}
```

## Configuration

```typescript
// src/config/analytics.ts
export const analyticsConfig = {
  posthog: {
    apiKey: import.meta.env.VITE_POSTHOG_API_KEY,
    apiHost: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
  },
  // Events to track automatically
  autoTrackEvents: [
    'board_created',
    'node_added',
    'export_completed',
    'collaboration_started',
  ],
  // Sensitive selectors to mask
  maskSelectors: [
    '.sensitive-data',
    '[data-sensitive]',
    'input[type="password"]',
  ],
};
```

## Testing

```typescript
// Mock PostHog in tests
jest.mock('posthog-js', () => ({
  default: {
    init: jest.fn(),
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    isFeatureEnabled: jest.fn(() => false),
  },
}));

describe('Analytics Tracking', () => {
  it('tracks board creation', () => {
    const { track } = renderHook(() => useAnalytics()).result.current;
    
    track('board_created', { board_id: '123' });
    
    expect(posthog.capture).toHaveBeenCalledWith(
      'board_created',
      expect.objectContaining({ board_id: '123' })
    );
  });
});
```

## GDPR Compliance

1. **Data Retention**: Set automatic data expiration
2. **User Rights**: Implement data export and deletion
3. **Consent**: Clear opt-in/opt-out mechanisms
4. **Data Minimization**: Only track necessary events
5. **Transparency**: Clear privacy policy