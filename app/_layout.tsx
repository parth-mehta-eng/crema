import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts as useInter, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts as useCormorant, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond';
import { colors } from '@/constants/theme';
import { onAuthSessionChange } from '@/services/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { useCoffeeBarStore } from '@/store/useCoffeeBarStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useRecipesStore } from '@/store/useRecipesStore';

SplashScreen.preventAutoHideAsync();
export default function RootLayout(){
 const [interLoaded]=useInter({Inter_400Regular,Inter_500Medium,Inter_600SemiBold,Inter_700Bold});
 const [cormLoaded]=useCormorant({CormorantGaramond_500Medium,CormorantGaramond_600SemiBold});
 const userId=useAuthStore((state)=>state.userId);
 const authInitialized=useAuthStore((state)=>state.initialized);
 const initializeAuth=useAuthStore((state)=>state.initialize);
 const setUserId=useAuthStore((state)=>state.setUserId);
 const loadRecipes=useRecipesStore((state)=>state.loadRecipes);
 const setFavoriteSession=useFavoritesStore((state)=>state.setSessionUser);
 const setInventorySession=useCoffeeBarStore((state)=>state.setSessionUser);
 useEffect(()=>{if(interLoaded&&cormLoaded) SplashScreen.hideAsync();},[interLoaded,cormLoaded]);
 useEffect(()=>{
  void loadRecipes();
  void initializeAuth();
  return onAuthSessionChange((_event,session)=>setUserId(session?.user.id??null));
 },[initializeAuth,loadRecipes,setUserId]);
 useEffect(()=>{
  if(!authInitialized) return;
  void Promise.all([setFavoriteSession(userId),setInventorySession(userId)]);
 },[authInitialized,setFavoriteSession,setInventorySession,userId]);
 if(!interLoaded||!cormLoaded) return null;
 return <SafeAreaProvider><StatusBar style="dark"/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.background}}}><Stack.Screen name="(tabs)"/><Stack.Screen name="recipe/[id]" options={{presentation:'card'}}/><Stack.Screen name="brew/[id]" options={{presentation:'card'}}/><Stack.Screen name="collection/index" options={{presentation:'card'}}/><Stack.Screen name="collection/[id]" options={{presentation:'card'}}/><Stack.Screen name="admin/index"/><Stack.Screen name="admin/draft/[id]"/></Stack></SafeAreaProvider>;
}
