import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Mail, 
  Shield, 
  Link2, 
  Unlink, 
  Key,
  Gift,
  Copy,
  CheckCircle
} from 'lucide-react';
import OAuthLoginButton from './OAuthLoginButton';

interface UserData {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

interface LinkedProvider {
  email: string;
  name: string;
  linked_at?: string;
  created_at?: string;
}

interface ReferralCode {
  id: string;
  code: string;
  uses_count: number;
  max_uses?: number;
  referrer_credits: number;
  referee_credits: number;
  expires_at?: string;
  is_active: boolean;
}

const UserProfile: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<Record<string, LinkedProvider>>({});
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form states
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [userResponse, providersResponse, referralsResponse] = await Promise.all([
        fetch('/api/v1/auth/me'),
        fetch('/api/v1/oauth/providers'),
        fetch('/api/v1/subscription/referral/codes')
      ]);

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
        setProfileForm({
          full_name: userData.full_name || '',
          email: userData.email
        });
      }

      if (providersResponse.ok) {
        const providersData = await providersResponse.json();
        setLinkedProviders(providersData.providers || {});
      }

      if (referralsResponse.ok) {
        const referralsData = await referralsResponse.json();
        setReferralCodes(referralsData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);

    try {
      const response = await fetch('/api/v1/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });

      if (response.ok) {
        loadUserData();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setUpdating(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('New passwords do not match');
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        })
      });

      if (response.ok) {
        setPasswordForm({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        alert('Password changed successfully');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error changing password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
    }
  };

  const unlinkProvider = async (provider: string) => {
    if (!confirm(`Are you sure you want to unlink your ${provider} account?`)) return;

    try {
      const response = await fetch(`/api/v1/oauth/unlink/${provider}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadUserData();
      }
    } catch (error) {
      console.error('Error unlinking provider:', error);
    }
  };

  const createReferralCode = async () => {
    try {
      const response = await fetch('/api/v1/subscription/referral/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.ok) {
        loadUserData();
      }
    } catch (error) {
      console.error('Error creating referral code:', error);
    }
  };

  const copyReferralCode = async (code: string) => {
    const referralUrl = `${window.location.origin}/signup?ref=${code}`;
    await navigator.clipboard.writeText(referralUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      {user && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar_url} alt={user.username} />
                <AvatarFallback>
                  {user.full_name 
                    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
                    : user.username[0].toUpperCase()
                  }
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{user.full_name || user.username}</h1>
                <p className="text-gray-600">{user.email}</p>
                <div className="flex gap-2 mt-2">
                  {user.is_verified && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                  {user.is_active && (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="accounts">Linked Accounts</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={updateProfile} className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    disabled
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Email cannot be changed. Contact support if needed.
                  </p>
                </div>
                <Button type="submit" disabled={updating}>
                  {updating ? 'Updating...' : 'Update Profile'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Manage your password and security preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={changePassword} className="space-y-4">
                <div>
                  <Label htmlFor="current_password">Current Password</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm_password">Confirm New Password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                    placeholder="Confirm new password"
                  />
                </div>
                <Button type="submit">
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Linked Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Linked Accounts
              </CardTitle>
              <CardDescription>
                Connect your social accounts for easier sign-in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {['google', 'github'].map((provider) => (
                <div key={provider} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      provider === 'google' ? 'bg-red-100' : 'bg-gray-900'
                    }`}>
                      {provider === 'google' ? (
                        <Mail className="h-5 w-5 text-red-600" />
                      ) : (
                        <Key className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium capitalize">{provider}</div>
                      {linkedProviders[provider] ? (
                        <div className="text-sm text-gray-600">
                          Connected as {linkedProviders[provider].email}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">Not connected</div>
                      )}
                    </div>
                  </div>
                  <div>
                    {linkedProviders[provider] ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => unlinkProvider(provider)}
                      >
                        <Unlink className="h-4 w-4 mr-2" />
                        Unlink
                      </Button>
                    ) : (
                      <OAuthLoginButton provider={provider as 'google' | 'github'} />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Referral Program
              </CardTitle>
              <CardDescription>
                Invite friends and earn credits for both of you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900">How it works</h3>
                <p className="text-sm text-blue-800 mt-1">
                  Share your referral link with friends. When they sign up and upgrade to a paid plan,
                  you both receive bonus credits!
                </p>
              </div>

              <div className="flex justify-between items-center">
                <h3 className="font-medium">Your Referral Codes</h3>
                <Button onClick={createReferralCode} size="sm">
                  Create New Code
                </Button>
              </div>

              <div className="space-y-3">
                {referralCodes.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No referral codes yet. Create one to start earning!
                  </p>
                ) : (
                  referralCodes.map((code) => (
                    <div key={code.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium font-mono text-lg">{code.code}</div>
                          <div className="text-sm text-gray-600">
                            Used {code.uses_count} times
                            {code.max_uses && ` of ${code.max_uses}`}
                            {code.expires_at && ` • Expires ${new Date(code.expires_at).toLocaleDateString()}`}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyReferralCode(code.code)}
                        >
                          {copiedCode === code.code ? (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          ) : (
                            <Copy className="h-4 w-4 mr-2" />
                          )}
                          {copiedCode === code.code ? 'Copied!' : 'Copy Link'}
                        </Button>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        Rewards: {code.referee_credits} credits for new users, {code.referrer_credits} credits for you
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserProfile;