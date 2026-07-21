'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, User, Lock, Mail, Loader2, Save, Trash2, Camera, AlertTriangle, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';

import Navbar from '@/components/Navbar';
import { api, getAccessToken, removeAccessToken } from '@/lib/api';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone_number: z.string().or(z.literal('')),
  city: z.string().or(z.literal('')),
});

const passwordSchema = z.object({
  old_password: z.string().min(1, 'Old password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters')
    .refine((val) => /[A-Z]/.test(val), { message: "Must contain an uppercase letter" })
    .refine((val) => /[a-z]/.test(val), { message: "Must contain a lowercase letter" })
    .refine((val) => /\d/.test(val), { message: "Must contain a number" })
    .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), { message: "Must contain a special symbol" }),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

type ProfileFields = z.infer<typeof profileSchema>;
type PasswordFields = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setAccessTokenState(token);
  }, [router]);

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ['userMe'],
    queryFn: async () => {
      const res = await api.get('/users/me');
      return res.data;
    },
    enabled: !!accessToken,
  });

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileFields>({
    resolver: zodResolver(profileSchema),
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFields>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (user) {
      resetProfile({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        city: user.city || '',
      });
    }
  }, [user, resetProfile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFields) => {
      const res = await api.put('/users/profile', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Profile updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['userMe'] });
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to update profile.';
      toast.error(errorMsg);
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    },
    onMutate: () => {
      setIsUploading(true);
    },
    onSuccess: () => {
      toast.success('Avatar updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['userMe'] });
      setIsUploading(false);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to upload avatar.';
      toast.error(errorMsg);
      setIsUploading(false);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFields) => {
      const res = await api.put('/users/change-password', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Password updated successfully.');
      resetPassword();
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to change password.';
      toast.error(errorMsg);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete('/users/me');
      return res.data;
    },
    onSuccess: () => {
      removeAccessToken();
      toast.success('Your account has been deleted.');
      router.push('/register');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to delete account.';
      toast.error(errorMsg);
    },
  });

  const onProfileSubmit = (data: ProfileFields) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFields) => {
    changePasswordMutation.mutate(data);
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatarMutation.mutate(file);
    }
  };

  if (isUserLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col pt-24 px-4 pb-12 max-w-5xl mx-auto">
      <Navbar />

      <h1 className="text-3xl font-extrabold tracking-tight text-white mb-8">
        Account Settings
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 glow-on-hover flex flex-col items-center text-center">
            <div className="relative group mb-4 cursor-pointer" onClick={handleAvatarClick}>
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-2xl overflow-hidden border border-white/10 relative">
                {isUploading ? (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  </div>
                ) : user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                ) : (
                  user.full_name ? user.full_name[0].toUpperCase() : 'D'
                )}
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <Camera className="w-5 h-5 text-white" />
                  <span className="text-[9px] text-zinc-300 font-semibold uppercase tracking-wider">Upload</span>
                </div>
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />

            <h3 className="text-lg font-bold text-white mb-1">{user.full_name || 'Developer'}</h3>
            <span className="text-zinc-500 text-xs font-mono mb-4">{user.email}</span>
            
            <div className="w-full border-t border-white/5 pt-4 text-xs text-left space-y-2.5 text-zinc-400">
              <div className="flex justify-between">
                <span>Account Type:</span>
                <span className="font-semibold text-zinc-200 uppercase">{user.oauth_provider || 'Standard'}</span>
              </div>
              <div className="flex justify-between">
                <span>MFA Enabled:</span>
                <span className="font-semibold text-zinc-200">No</span>
              </div>
              {user.phone_number && (
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span className="font-semibold text-zinc-200">{user.phone_number}</span>
                </div>
              )}
              {user.city && (
                <div className="flex justify-between">
                  <span>Location:</span>
                  <span className="font-semibold text-zinc-200">{user.city}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 md:p-8 glow-on-hover">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              Personal Profile
            </h2>

            <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                    Full Name
                  </label>
                  <input
                    type="text"
                    className={`glass-input w-full px-4 py-2.5 rounded-lg text-sm ${
                      profileErrors.full_name ? 'border-red-500/50' : ''
                    }`}
                    {...registerProfile('full_name')}
                  />
                  {profileErrors.full_name && (
                    <p className="text-red-500 text-xs mt-1">{profileErrors.full_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="+1 (555) 019-2834"
                      className={`glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm ${
                        profileErrors.phone_number ? 'border-red-500/50' : ''
                      }`}
                      {...registerProfile('phone_number')}
                    />
                  </div>
                  {profileErrors.phone_number && (
                    <p className="text-red-500 text-xs mt-1">{profileErrors.phone_number.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                    City / Place Living
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Hyderabad, India"
                      className={`glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm ${
                        profileErrors.city ? 'border-red-500/50' : ''
                      }`}
                      {...registerProfile('city')}
                    />
                  </div>
                  {profileErrors.city && (
                    <p className="text-red-500 text-xs mt-1">{profileErrors.city.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Profile
                </button>
              </div>
            </form>
          </div>

          {!user.oauth_provider && (
            <div className="glass-panel rounded-2xl p-6 md:p-8 glow-on-hover">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-400" />
                Change Password
              </h2>

              <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                    Current Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className={`glass-input w-full px-4 py-2.5 rounded-lg text-sm ${
                      passwordErrors.old_password ? 'border-red-500/50' : ''
                    }`}
                    {...registerPassword('old_password')}
                  />
                  {passwordErrors.old_password && (
                    <p className="text-red-500 text-xs mt-1">{passwordErrors.old_password.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className={`glass-input w-full px-4 py-2.5 rounded-lg text-sm ${
                        passwordErrors.new_password ? 'border-red-500/50' : ''
                      }`}
                      {...registerPassword('new_password')}
                    />
                    {passwordErrors.new_password && (
                      <p className="text-red-500 text-xs mt-1">{passwordErrors.new_password.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className={`glass-input w-full px-4 py-2.5 rounded-lg text-sm ${
                        passwordErrors.confirm_password ? 'border-red-500/50' : ''
                      }`}
                      {...registerPassword('confirm_password')}
                    />
                    {passwordErrors.confirm_password && (
                      <p className="text-red-500 text-xs mt-1">{passwordErrors.confirm_password.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-500 hover:to-blue-400 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {changePasswordMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    Change Password
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="glass-panel border-red-500/10 hover:border-red-500/20 rounded-2xl p-6 md:p-8 glow-on-hover">
            <h2 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </h2>
            <p className="text-zinc-400 text-xs leading-relaxed mb-6">
              Deleting your account is permanent and cannot be undone. All active sessions, user credentials, and configurations associated with your profile will be wiped out from the platform.
            </p>

            {confirmDelete ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-red-950/20 border border-red-900/20 rounded-xl p-4">
                <div className="flex gap-2 items-center text-xs text-red-400 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Are you absolutely sure?
                </div>
                <div className="flex gap-2 sm:ml-auto w-full sm:w-auto">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 border border-white/5 text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteAccountMutation.isPending}
                    className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-500 transition-all cursor-pointer"
                  >
                    {deleteAccountMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    Delete Permanent
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-red-950/30 border border-red-900/30 text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
