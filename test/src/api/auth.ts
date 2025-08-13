// src/api/auth.ts
import { supabase } from '../supabaseClient';
import type { User } from '../types/type';

// loginUser now works with your Database typing
export async function loginUser(email: string, password: string): Promise<User | null> {
  try {
    // 1️⃣ Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('Login error:', authError.message);
      return null;
    }

    if (!authData.user) {
      console.error('No user returned from Supabase Auth');
      return null;
    }

    const uid = authData.user.id;

    // 2️⃣ Fetch the corresponding row from your "users" table
    const { data: userData, error: userError } = await supabase
      .from('users')  // ✅ do NOT pass <User> here
      .select('*')
      .eq('id', uid)
      .single();

    if (userError) {
      console.error('Error fetching user record:', userError.message);
      return null;
    }

    if (!userData) return null;

    // 3️⃣ Map snake_case to camelCase if you prefer
    const user: User = {
      ...userData,
      createdBy: userData.createdAby,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
    };

    console.log('Logged in as:', user.username, 'role:', user.role);
    return user;

  } catch (err) {
    console.error('Unexpected login error:', err);
    return null;
  }
}
