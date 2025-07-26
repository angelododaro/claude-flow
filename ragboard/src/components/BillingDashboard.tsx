import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Download, 
  Zap, 
  Users, 
  Database, 
  Settings, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  type: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  ai_credits: number;
  storage_gb: number;
  max_team_members: number;
  max_boards: number;
  features: Record<string, boolean>;
  is_popular?: boolean;
}

interface Subscription {
  id: string;
  status: string;
  is_yearly: boolean;
  current_credits: number;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  plan: Plan;
}

interface UsageStats {
  total_credits_used: number;
  credits_remaining: number;
  usage_by_type: Record<string, number>;
  daily_usage: Array<{ date: string; credits: number }>;
}

const BillingDashboard: React.FC = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      const [subResponse, plansResponse, usageResponse] = await Promise.all([
        fetch('/api/v1/subscription/current'),
        fetch('/api/v1/subscription/plans'),
        fetch('/api/v1/subscription/usage')
      ]);

      if (subResponse.ok) {
        setSubscription(await subResponse.json());
      }
      if (plansResponse.ok) {
        setPlans(await plansResponse.json());
      }
      if (usageResponse.ok) {
        setUsage(await usageResponse.json());
      }
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(0)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'trialing': return 'bg-blue-500';
      case 'past_due': return 'bg-yellow-500';
      case 'canceled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleUpgrade = async (planId: string, isYearly: boolean = false) => {
    // This would open a Stripe payment flow
    console.log('Upgrading to plan:', planId, 'yearly:', isYearly);
    // Implementation would use Stripe Elements or redirect to checkout
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;

    try {
      const response = await fetch('/api/v1/subscription/cancel', {
        method: 'POST'
      });

      if (response.ok) {
        loadBillingData();
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const creditsUsagePercentage = usage && subscription 
    ? Math.min(100, (usage.total_credits_used / subscription.current_credits) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Subscription Overview */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{subscription.plan.name} Plan</h3>
                <p className="text-sm text-gray-600">{subscription.plan.description}</p>
              </div>
              <Badge className={`${getStatusColor(subscription.status)} text-white`}>
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{subscription.current_credits.toLocaleString()}</div>
                <div className="text-sm text-gray-600">AI Credits</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{subscription.plan.storage_gb}GB</div>
                <div className="text-sm text-gray-600">Storage</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{subscription.plan.max_team_members}</div>
                <div className="text-sm text-gray-600">Team Members</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{subscription.plan.max_boards}</div>
                <div className="text-sm text-gray-600">Max Boards</div>
              </div>
            </div>

            {subscription.current_period_end && (
              <div className="text-sm text-gray-600">
                {subscription.status === 'canceled' 
                  ? `Subscription ends on ${formatDate(subscription.current_period_end)}`
                  : `Next billing date: ${formatDate(subscription.current_period_end)}`
                }
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage Statistics */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage This Period
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>AI Credits Used</span>
                <span>{usage.total_credits_used.toLocaleString()} / {subscription?.current_credits.toLocaleString()}</span>
              </div>
              <Progress value={creditsUsagePercentage} className="h-2" />
              {creditsUsagePercentage > 80 && (
                <div className="flex items-center gap-1 mt-2 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Running low on credits</span>
                </div>
              )}
            </div>

            {Object.keys(usage.usage_by_type).length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Usage by Type</h4>
                <div className="space-y-2">
                  {Object.entries(usage.usage_by_type).map(([type, credits]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                      <span>{credits.toLocaleString()} credits</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Choose the plan that best fits your needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div 
                key={plan.id} 
                className={`border rounded-lg p-6 relative ${
                  plan.is_popular ? 'border-blue-500 shadow-lg' : 'border-gray-200'
                }`}
              >
                {plan.is_popular && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500">
                    Most Popular
                  </Badge>
                )}
                
                <div className="text-center">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                  
                  <div className="mt-4">
                    <div className="text-3xl font-bold">
                      {plan.price_monthly === 0 ? 'Free' : formatPrice(plan.price_monthly)}
                    </div>
                    {plan.price_monthly > 0 && (
                      <div className="text-sm text-gray-600">
                        per month, or {formatPrice(plan.price_yearly)}/year
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">{plan.ai_credits.toLocaleString()} AI Credits</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">{plan.storage_gb}GB Storage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{plan.max_team_members} Team Members</span>
                  </div>
                </div>

                <div className="mt-6">
                  {subscription?.plan.id === plan.id ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      {plan.price_monthly > 0 && (
                        <>
                          <Button 
                            className="w-full" 
                            onClick={() => handleUpgrade(plan.id, false)}
                          >
                            Upgrade - Monthly
                          </Button>
                          <Button 
                            variant="outline" 
                            className="w-full" 
                            onClick={() => handleUpgrade(plan.id, true)}
                          >
                            Upgrade - Yearly (Save 20%)
                          </Button>
                        </>
                      )}
                      {plan.type === 'free' && !subscription && (
                        <Button className="w-full" onClick={() => handleUpgrade(plan.id)}>
                          Get Started
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing Actions */}
      {subscription && subscription.plan.type !== 'free' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Billing Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Update Payment Method
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Invoices
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancelSubscription}
              >
                Cancel Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillingDashboard;