import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText, DisplayText } from '@/components/AppText';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { colors, font, radius, spacing } from '@/constants/theme';
import {
  bulkArchiveDrafts,
  bulkAssignCollection,
  bulkAssignSource,
  bulkMarkAttributionComplete,
  bulkSetNeedsTesting,
  draftsToCsv,
  draftsToJson,
  exportDraftsForBackup,
  getAdminAccess,
  loadAdminDashboard,
  markDraftsReviewed,
  runAdminAction,
  signInAdmin,
  signOutAdmin,
  type AdminAction,
  type AdminDashboardData,
  type AdminRecipeDraft,
} from '@/services/admin';
import { supabase } from '@/lib/supabase';

type AdminSection = 'Sources' | 'Imports' | 'Discovered' | 'Drafts' | 'Quality' | 'Review Queue' | 'Ingredients' | 'Collections';
const sections: AdminSection[] = ['Sources', 'Imports', 'Discovered', 'Drafts', 'Quality', 'Review Queue', 'Ingredients', 'Collections'];

function draftMissingRequirements(draft: AdminRecipeDraft): string[] {
  const missing: string[] = [];
  if (!draft.proposed_title) missing.push('title');
  if (!draft.slug) missing.push('slug');
  if (!draft.description) missing.push('description');
  if (!draft.difficulty) missing.push('difficulty');
  if (!draft.prep_minutes) missing.push('prep time');
  if (!draft.servings) missing.push('servings');
  if (!draft.recipe_draft_ingredients?.length) missing.push('ingredients');
  if (!draft.recipe_draft_steps?.length) missing.push('steps');
  if (!draft.recipe_draft_equipment?.length) missing.push('equipment');
  if (draft.image_status === 'missing') missing.push('image');
  if (draft.attribution_status === 'required' || draft.attribution_status === 'incomplete') missing.push('attribution');
  if (draft.needs_testing || !draft.tested) missing.push('testing');
  return missing;
}

/** Higher score = higher review priority, per docs/WEEKEND_6.md review-queue ordering. */
function reviewPriorityScore(draft: AdminRecipeDraft): number {
  const isCafeInspired = /inspired/i.test(draft.inspiration_label);
  const isEspressoClassic = draft.category === 'classic';
  const isSeasonal = draft.category === 'seasonal';
  const missing = draftMissingRequirements(draft);
  const hasCompleteIngredients = !missing.includes('ingredients') && !missing.includes('steps');

  if (isCafeInspired) return 100;
  if (isEspressoClassic) return 90;
  if (hasCompleteIngredients && (draft.needs_testing || !draft.tested)) return 80;
  if (missing.length === 1) return 70;
  if (isSeasonal) return 60;
  return 10;
}
const ingredientCategories = ['coffee', 'espresso', 'milk', 'syrup', 'sauce', 'sweetener', 'spice', 'topping', 'pantry', 'tea', 'matcha', 'other'];
const ingredientUnits = ['shot', 'oz', 'fl oz', 'cup', 'tbsp', 'tsp', 'mL', 'g', 'pinch', 'pump', 'piece', 'to taste'];

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.secondaryAction,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <AppText style={[styles.actionText, secondary && styles.secondaryActionText]}>{label}</AppText>
    </Pressable>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <View style={styles.statusPill}>
      <AppText style={styles.statusText}>{status.replaceAll('_', ' ')}</AppText>
    </View>
  );
}

function IngredientCatalogEditor({ item, busy, onSave }: { item?: AdminDashboardData['ingredients'][number]; busy: boolean; onSave: (action: AdminAction) => void }) {
  const [id, setId] = useState(item?.id ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [canonicalName, setCanonicalName] = useState(item?.canonical_name ?? '');
  const [category, setCategory] = useState(item?.category ?? 'other');
  const [aliases, setAliases] = useState(item?.aliases.join(', ') ?? '');
  const [defaultUnit, setDefaultUnit] = useState(item?.default_unit ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  return <View style={styles.editor}>
    <View style={styles.twoColumn}><View style={styles.grow}><AppText style={styles.inputLabel}>ID</AppText><TextInput editable={!item} value={id} onChangeText={(value) => setId(value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} style={styles.input} /></View><View style={styles.grow}><AppText style={styles.inputLabel}>Display name</AppText><TextInput value={name} onChangeText={setName} style={styles.input} /></View></View>
    <AppText style={styles.inputLabel}>Canonical name</AppText><TextInput value={canonicalName} onChangeText={setCanonicalName} style={styles.input} />
    <AppText style={styles.inputLabel}>Aliases, comma separated</AppText><TextInput value={aliases} onChangeText={setAliases} style={styles.input} />
    <AppText style={styles.inputLabel}>Category</AppText><View style={styles.filterRow}>{ingredientCategories.map((value) => <ActionButton key={value} label={value} secondary={category !== value} onPress={() => setCategory(value)} />)}</View>
    <AppText style={styles.inputLabel}>Default unit</AppText><View style={styles.filterRow}><ActionButton label="none" secondary={defaultUnit !== ''} onPress={() => setDefaultUnit('')} />{ingredientUnits.map((value) => <ActionButton key={value} label={value} secondary={defaultUnit !== value} onPress={() => setDefaultUnit(value)} />)}</View>
    <View style={styles.actions}><ActionButton label={active ? 'Active' : 'Inactive'} secondary={!active} onPress={() => setActive(!active)} /><ActionButton label={item ? 'Save ingredient' : 'Create ingredient'} disabled={busy || !id || !name.trim() || !canonicalName.trim()} onPress={() => onSave({ action: 'save-ingredient', ingredient: { id, name, canonicalName, category, aliases: aliases.split(',').map((value) => value.trim()).filter(Boolean), defaultUnit: defaultUnit || null, active } })} /></View>
  </View>;
}

function CollectionEditor({ item, busy, onSave }: { item?: AdminDashboardData['collections'][number]; busy: boolean; onSave: (action: AdminAction) => void }) {
  const [id, setId] = useState(item?.id ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(item?.sort_order ?? 100));
  const [active, setActive] = useState(item?.active ?? true);
  return <View style={styles.editor}>
    <View style={styles.twoColumn}><View style={styles.grow}><AppText style={styles.inputLabel}>ID</AppText><TextInput editable={!item} value={id} onChangeText={(value) => setId(value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} style={styles.input} /></View><View style={styles.grow}><AppText style={styles.inputLabel}>Title</AppText><TextInput value={title} onChangeText={setTitle} style={styles.input} /></View></View>
    <AppText style={styles.inputLabel}>Description</AppText><TextInput multiline value={description} onChangeText={setDescription} style={[styles.input, styles.multiline]} />
    <AppText style={styles.inputLabel}>Sort order</AppText><TextInput keyboardType="numeric" value={sortOrder} onChangeText={setSortOrder} style={styles.input} />
    <View style={styles.actions}><ActionButton label={active ? 'Active' : 'Inactive'} secondary={!active} onPress={() => setActive(!active)} /><ActionButton label={item ? 'Save collection' : 'Create collection'} disabled={busy || !id || !title.trim()} onPress={() => onSave({ action: 'save-collection', collection: { id, title, description, sortOrder: Number(sortOrder) || 0, active } })} /></View>
  </View>;
}

export default function AdminDashboard() {
  const [section, setSection] = useState<AdminSection>('Sources');
  const [access, setAccess] = useState<'loading' | 'admin' | 'denied'>('loading');
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [draftSearch, setDraftSearch] = useState('');
  const [draftFilter, setDraftFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [bulkCollectionId, setBulkCollectionId] = useState('');
  const [bulkSourceName, setBulkSourceName] = useState('');
  const [bulkSourceUrl, setBulkSourceUrl] = useState('');
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exportText, setExportText] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const adminAccess = await getAdminAccess();
      setError(null);
      if (!adminAccess.signedIn || !adminAccess.isAdmin) {
        setAccess('denied');
        setData(null);
        return;
      }
      setAccess('admin');
      setData(await loadAdminDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Admin data could not be loaded.');
      setAccess('denied');
    }
  }, []);

  useEffect(() => {
    const refreshTask = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(refreshTask);
  }, [refresh]);

  const latestRuns = useMemo(() => {
    const bySource = new Map<string, AdminDashboardData['runs'][number]>();
    data?.runs.forEach((run) => {
      if (!bySource.has(run.source_id)) bySource.set(run.source_id, run);
    });
    return bySource;
  }, [data]);

  const visibleDrafts = useMemo(() => {
    const query = draftSearch.trim().toLowerCase();
    return data?.drafts.filter((draft) => {
      const matchesText = !query || [draft.proposed_title, draft.source_name, draft.flavor_notes.join(' '), draft.suggested_ingredients.join(' ')].join(' ').toLowerCase().includes(query);
      const matchesStatus = draftFilter === 'all'
        || (draftFilter === 'incomplete' && draft.status === 'draft')
        || (draftFilter === 'needs testing' && draft.needs_testing)
        || (draftFilter === 'missing image' && draft.image_status === 'missing')
        || (draftFilter === 'invalid' && draft.validation_status === 'invalid')
        || (draftFilter === 'ready for review' && draft.validation_status === 'valid' && draft.status !== 'published' && draft.status !== 'archived')
        || draft.status === draftFilter;
      const matchesCollection = collectionFilter === 'all'
        || draft.recipe_draft_collections?.some((entry) => entry.collection_id === collectionFilter);
      return matchesText && matchesStatus && matchesCollection && (sourceFilter === 'all' || draft.source_name === sourceFilter) && (categoryFilter === 'all' || draft.category === categoryFilter);
    }) ?? [];
  }, [categoryFilter, collectionFilter, data, draftFilter, draftSearch, sourceFilter]);

  const qualityStats = useMemo(() => {
    const drafts = data?.drafts ?? [];
    const bySource = new Map<string, number>();
    const byCollection = new Map<string, number>();
    for (const draft of drafts) {
      bySource.set(draft.source_name || 'Unspecified', (bySource.get(draft.source_name || 'Unspecified') ?? 0) + 1);
      for (const entry of draft.recipe_draft_collections ?? []) {
        const title = entry.recipe_collections?.title ?? entry.collection_id;
        byCollection.set(title, (byCollection.get(title) ?? 0) + 1);
      }
    }
    return {
      totalDiscovered: data?.drinks.length ?? 0,
      totalDrafts: drafts.length,
      missingImages: drafts.filter((d) => d.image_status === 'missing').length,
      needsTesting: drafts.filter((d) => d.needs_testing).length,
      missingIngredients: drafts.filter((d) => !d.recipe_draft_ingredients?.length).length,
      missingSteps: drafts.filter((d) => !d.recipe_draft_steps?.length).length,
      readyForReview: drafts.filter((d) => d.validation_status === 'valid' && d.status !== 'published' && d.status !== 'archived').length,
      published: drafts.filter((d) => d.status === 'published').length,
      bySource: [...bySource.entries()].sort((a, b) => b[1] - a[1]),
      byCollection: [...byCollection.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [data]);

  const reviewQueue = useMemo(() => {
    const drafts = data?.drafts.filter((d) => d.status !== 'published' && d.status !== 'archived') ?? [];
    return [...drafts].sort((a, b) => reviewPriorityScore(b) - reviewPriorityScore(a));
  }, [data]);

  const toggleDraftSelection = (draftId: string) => {
    setSelectedDraftIds((current) => {
      const next = new Set(current);
      if (next.has(draftId)) next.delete(draftId);
      else next.add(draftId);
      return next;
    });
  };

  const runBulk = async (message: string, fn: () => Promise<void>) => {
    setBulkPending(true);
    setBulkMessage(null);
    try {
      await fn();
      setBulkMessage(message);
      setSelectedDraftIds(new Set());
      await refresh();
    } catch (caught) {
      setBulkMessage(caught instanceof Error ? caught.message : 'The bulk action failed.');
    } finally {
      setBulkPending(false);
    }
  };

  const runExport = async () => {
    setBulkPending(true);
    try {
      const rows = await exportDraftsForBackup([...selectedDraftIds]);
      setExportText(exportFormat === 'json' ? draftsToJson(rows) : draftsToCsv(rows));
    } catch (caught) {
      setBulkMessage(caught instanceof Error ? caught.message : 'Export failed.');
    } finally {
      setBulkPending(false);
    }
  };

  const act = async (key: string, action: AdminAction) => {
    setPending(key);
    setError(null);
    try {
      await runAdminAction(action);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The admin action failed.');
    } finally {
      setPending(null);
    }
  };

  const convertAndOpen = async (drinkId: string) => {
    setPending(`drink-${drinkId}`);
    setError(null);
    try {
      const draft = await runAdminAction({ action: 'convert-drink', drinkId }) as { id: string };
      router.push({ pathname: '/admin/draft/[id]', params: { id: draft.id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The drink could not be converted.');
    } finally {
      setPending(null);
    }
  };

  const signIn = async () => {
    setPending('sign-in');
    setError(null);
    try {
      await signInAdmin(email, password);
      setPassword('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Admin sign-in failed.');
    } finally {
      setPending(null);
    }
  };

  const signOut = async () => {
    setPending('sign-out');
    try {
      await signOutAdmin();
      setData(null);
      setAccess('denied');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Admin sign-out failed.');
    } finally {
      setPending(null);
    }
  };

  if (access === 'loading') {
    return <Screen><LoadingState label="Checking admin access" /></Screen>;
  }

  if (access === 'denied') {
    return (
      <Screen contentStyle={styles.centered}>
        <View style={styles.signInCard}>
          <Ionicons name="lock-closed-outline" size={28} color={colors.espresso} />
          <DisplayText style={styles.signInTitle}>Admin access required</DisplayText>
          <AppText style={styles.signInBody}>
            Sign in with a development account whose secure app metadata role is admin.
          </AppText>
          {error ? <AppText style={styles.warning}>{error}</AppText> : null}
          <AppText style={styles.inputLabel}>Email</AppText>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <AppText style={styles.inputLabel}>Password</AppText>
          <TextInput
            autoCapitalize="none"
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <View style={styles.actions}>
            <ActionButton label="Back to Crema" secondary onPress={() => router.replace('/')} />
            <ActionButton
              label="Sign in"
              disabled={pending === 'sign-in' || !email.trim() || !password}
              onPress={() => void signIn()}
            />
          </View>
        </View>
      </Screen>
    );
  }

  if (!data) return <Screen><LoadingState label="Loading discovery workspace" /></Screen>;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText style={styles.eyebrow}>PRIVATE WORKSPACE</AppText>
          <DisplayText style={styles.title}>Coffee discovery</DisplayText>
          <AppText style={styles.subtitle}>Review public menu references before anything becomes a Crema recipe.</AppText>
        </View>
        <View style={styles.headerActions}>
          <ActionButton label="Sign out" secondary disabled={pending === 'sign-out'} onPress={() => void signOut()} />
          <Pressable accessibilityLabel="Close admin workspace" onPress={() => router.replace('/')} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {sections.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === item }}
            onPress={() => setSection(item)}
            style={[styles.tab, section === item && styles.selectedTab]}
          >
            <AppText style={[styles.tabText, section === item && styles.selectedTabText]}>{item}</AppText>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <AppText style={styles.errorText}>{error}</AppText>
          <ActionButton label="Retry" secondary onPress={() => void refresh()} />
        </View>
      ) : null}

      <View style={styles.content}>
        {section === 'Sources' ? data.sources.map((source) => {
          const latest = latestRuns.get(source.id);
          const sourcePending = pending === `source-${source.id}`;
          return (
            <View key={source.id} style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.grow}>
                  <DisplayText style={styles.cardTitle}>{source.name}</DisplayText>
                  <AppText style={styles.meta}>{source.parser_type} parser · {source.enabled ? 'Enabled' : 'Disabled'}</AppText>
                </View>
                <StatusPill status={latest?.status ?? 'not run'} />
              </View>
              <AppText style={styles.url} onPress={() => void Linking.openURL(source.menu_url)}>{source.menu_url}</AppText>
              <AppText style={styles.meta}>Last imported: {formatDate(source.last_imported_at)}</AppText>
              <View style={styles.actions}>
                <ActionButton
                  label={source.enabled ? 'Disable source' : 'Enable source'}
                  secondary
                  disabled={sourcePending}
                  onPress={() => void act(`source-${source.id}`, {
                    action: 'update-source-enabled',
                    sourceId: source.id,
                    enabled: !source.enabled,
                  })}
                />
                <ActionButton
                  label="Run import"
                  disabled={sourcePending}
                  onPress={() => void act(`source-${source.id}`, { action: 'import-source', sourceId: source.id })}
                />
              </View>
            </View>
          );
        }) : null}

        {section === 'Imports' ? data.runs.map((run) => (
          <View key={run.id} style={styles.card}>
            <View style={styles.cardHeading}>
              <DisplayText style={styles.cardTitle}>{run.coffee_sources?.name ?? 'Unknown source'}</DisplayText>
              <StatusPill status={run.status} />
            </View>
            <AppText style={styles.meta}>{formatDate(run.started_at)}</AppText>
            <AppText style={styles.counts}>
              {run.discovered_count} discovered · {run.new_count} new · {run.duplicate_count} duplicates · {run.updated_count} updated · {run.failed_count} failed
            </AppText>
            {run.error_message ? <AppText style={styles.warning}>{run.error_message}</AppText> : null}
          </View>
        )) : null}

        {section === 'Discovered' ? data.drinks.map((drink) => {
          const drinkPending = pending === `drink-${drink.id}`;
          return (
            <View key={drink.id} style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.grow}>
                  <DisplayText style={styles.cardTitle}>{drink.external_name}</DisplayText>
                  <AppText style={styles.meta}>{drink.coffee_sources?.name} · {drink.category} · {drink.temperature}</AppText>
                </View>
                <StatusPill status={drink.status} />
              </View>
              {drink.external_description ? <AppText style={styles.body}>{drink.external_description}</AppText> : null}
              <AppText style={styles.meta}>{drink.flavor_notes.join(', ') || 'No controlled flavor notes'}</AppText>
              <AppText style={styles.url} onPress={() => void Linking.openURL(drink.source_url)}>Open source page</AppText>
              <View style={styles.actions}>
                {drink.status === 'new' || drink.status === 'ignored' ? (
                  <ActionButton
                    label="Mark reviewed"
                    disabled={drinkPending}
                    onPress={() => void act(`drink-${drink.id}`, {
                      action: 'update-drink-status', drinkId: drink.id, status: 'reviewed',
                    })}
                  />
                ) : null}
                {drink.status === 'new' || drink.status === 'reviewed' ? (
                  <ActionButton
                    label="Ignore"
                    secondary
                    disabled={drinkPending}
                    onPress={() => void act(`drink-${drink.id}`, {
                      action: 'update-drink-status', drinkId: drink.id, status: 'ignored',
                    })}
                  />
                ) : null}
                {drink.status === 'reviewed' ? (
                  <ActionButton
                    label="Convert to draft"
                    disabled={drinkPending}
                    onPress={() => void convertAndOpen(drink.id)}
                  />
                ) : null}
              </View>
            </View>
          );
        }) : null}

        {section === 'Drafts' ? (
          <View style={styles.draftTools}>
            <TextInput accessibilityLabel="Search recipe drafts" placeholder="Search title, source, flavors, ingredients" value={draftSearch} onChangeText={setDraftSearch} style={styles.input} />
            <View style={styles.filterRow}>
              {['all', 'incomplete', 'needs testing', 'missing image', 'invalid', 'ready for review', 'ready', 'published', 'archived'].map((filter) => <ActionButton key={filter} label={filter} secondary={draftFilter !== filter} onPress={() => setDraftFilter(filter)} />)}
            </View>
            <View style={styles.filterRow}>
              {['all', ...new Set(data.drafts.map((draft) => draft.source_name).filter(Boolean))].map((source) => <ActionButton key={source} label={source} secondary={sourceFilter !== source} onPress={() => setSourceFilter(source)} />)}
            </View>
            <View style={styles.filterRow}>
              {['all', ...new Set(data.drafts.map((draft) => draft.category))].map((category) => <ActionButton key={category} label={category} secondary={categoryFilter !== category} onPress={() => setCategoryFilter(category)} />)}
            </View>
            <View style={styles.filterRow}>
              {[{ id: 'all', title: 'all collections' }, ...data.collections].map((collection) => <ActionButton key={collection.id} label={collection.title} secondary={collectionFilter !== collection.id} onPress={() => setCollectionFilter(collection.id)} />)}
            </View>
          </View>
        ) : null}

        {section === 'Drafts' && selectedDraftIds.size > 0 ? (
          <View style={styles.draftTools}>
            <DisplayText style={styles.cardTitle}>{selectedDraftIds.size} selected</DisplayText>
            <AppText style={styles.meta}>Bulk actions never publish — publishing stays a single-recipe action on each draft.</AppText>
            {bulkMessage ? <AppText style={styles.meta}>{bulkMessage}</AppText> : null}

            <AppText style={styles.inputLabel}>Assign collection</AppText>
            <View style={styles.filterRow}>
              {data.collections.map((collection) => (
                <ActionButton
                  key={collection.id}
                  label={collection.title}
                  secondary={bulkCollectionId !== collection.id}
                  onPress={() => setBulkCollectionId(collection.id)}
                />
              ))}
            </View>
            <ActionButton
              label="Apply collection"
              disabled={bulkPending || !bulkCollectionId}
              onPress={() => void runBulk('Collection assigned.', () => bulkAssignCollection([...selectedDraftIds], bulkCollectionId))}
            />

            <AppText style={styles.inputLabel}>Assign source</AppText>
            <View style={styles.twoColumn}>
              <View style={styles.grow}><TextInput placeholder="Source name" value={bulkSourceName} onChangeText={setBulkSourceName} style={styles.input} /></View>
              <View style={styles.grow}><TextInput placeholder="https://source-url" value={bulkSourceUrl} onChangeText={setBulkSourceUrl} style={styles.input} /></View>
            </View>
            <ActionButton
              label="Apply source"
              disabled={bulkPending || !bulkSourceName.trim()}
              onPress={() => void runBulk('Source assigned.', () => bulkAssignSource([...selectedDraftIds], bulkSourceName.trim(), bulkSourceUrl.trim() || null))}
            />

            <View style={styles.actions}>
              <ActionButton label="Set needs testing" secondary disabled={bulkPending} onPress={() => void runBulk('Marked as needing testing.', () => bulkSetNeedsTesting([...selectedDraftIds], true))} />
              <ActionButton label="Clear needs testing" secondary disabled={bulkPending} onPress={() => void runBulk('Cleared needs-testing flag.', () => bulkSetNeedsTesting([...selectedDraftIds], false))} />
              <ActionButton label="Mark attribution complete" secondary disabled={bulkPending} onPress={() => void runBulk('Attribution marked complete.', () => bulkMarkAttributionComplete([...selectedDraftIds]))} />
              <ActionButton
                label="Mark reviewed"
                secondary
                disabled={bulkPending}
                onPress={() => void runBulk('Marked reviewed.', async () => {
                  const userId = (await supabase?.auth.getUser())?.data.user?.id;
                  if (!userId) throw new Error('Sign in again to record the reviewer.');
                  await markDraftsReviewed([...selectedDraftIds], userId);
                })}
              />
              <ActionButton
                label="Archive selected"
                secondary
                disabled={bulkPending}
                onPress={() => Alert.alert('Archive selected drafts?', `${selectedDraftIds.size} draft(s) will be archived. This is reversible.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void runBulk('Selected drafts archived.', () => bulkArchiveDrafts([...selectedDraftIds])) }])}
              />
            </View>

            <AppText style={styles.inputLabel}>Export selected</AppText>
            <View style={styles.filterRow}>
              <ActionButton label="JSON" secondary={exportFormat !== 'json'} onPress={() => setExportFormat('json')} />
              <ActionButton label="CSV" secondary={exportFormat !== 'csv'} onPress={() => setExportFormat('csv')} />
              <ActionButton label="Generate export" disabled={bulkPending} onPress={() => void runExport()} />
            </View>
            {exportText ? (
              <TextInput
                accessibilityLabel="Export output — select and copy"
                multiline
                editable={false}
                value={exportText}
                style={[styles.input, styles.multiline, styles.exportOutput]}
              />
            ) : null}

            <ActionButton label="Clear selection" secondary onPress={() => { setSelectedDraftIds(new Set()); setExportText(null); }} />
          </View>
        ) : null}

        {section === 'Drafts' ? visibleDrafts.map((draft) => {
          const draftPending = pending === `draft-${draft.id}`;
          const validationReady = Boolean(draft.proposed_title && draft.slug && draft.description && draft.difficulty && draft.prep_minutes && draft.servings && (draft.hero_image_url || draft.placeholder_approved) && draft.recipe_draft_ingredients?.length && draft.recipe_draft_steps?.length && draft.recipe_draft_equipment?.length && draft.tested && !draft.needs_testing);
          const selected = selectedDraftIds.has(draft.id);
          return (
            <View key={draft.id} style={styles.card}>
              <View style={styles.cardHeading}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Select ${draft.proposed_title} for bulk actions`}
                  hitSlop={8}
                  onPress={() => toggleDraftSelection(draft.id)}
                  style={[styles.checkbox, selected && styles.checkboxChecked]}
                >
                  {selected ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                </Pressable>
                <View style={styles.grow}>
                  <DisplayText style={styles.cardTitle}>{draft.proposed_title}</DisplayText>
                  <AppText style={styles.meta}>{draft.source_name} · {draft.category} · {draft.temperature}</AppText>
                </View>
                <StatusPill status={draft.status} />
              </View>
              <AppText style={draft.needs_testing ? styles.warning : styles.success}>
                {draft.needs_testing ? 'Needs testing' : 'Testing recorded'}
              </AppText>
              <AppText style={validationReady ? styles.success : styles.warning}>{validationReady ? 'Validation-ready' : 'Incomplete'}</AppText>
              <View style={styles.filterRow}>
                <StatusPill status={`image: ${draft.image_status}`} />
                <StatusPill status={`attribution: ${draft.attribution_status}`} />
                <StatusPill status={`validation: ${draft.validation_status}`} />
              </View>
              <AppText style={styles.meta}>Updated {formatDate(draft.updated_at)} · {draft.recipe_draft_collections?.map((item) => item.recipe_collections?.title).filter(Boolean).join(', ') || 'No collection'} · {draft.published_recipe_id ? 'Linked to public recipe' : 'Not published'}</AppText>
                <View style={styles.actions}>
                  <ActionButton label="Edit" secondary onPress={() => router.push({ pathname: '/admin/draft/[id]', params: { id: draft.id } })} />
                  <ActionButton label="Preview" secondary onPress={() => router.push({ pathname: '/admin/draft/[id]', params: { id: draft.id, preview: '1' } })} />
                  <ActionButton label="Duplicate" secondary disabled={draftPending} onPress={() => void act(`draft-${draft.id}`, { action: 'duplicate-authoring-draft', draftId: draft.id })} />
                  {draft.status === 'draft' ? (
                    <ActionButton
                      label="Mark tested"
                      disabled={draftPending}
                      onPress={() => void act(`draft-${draft.id}`, {
                        action: 'transition-authoring-draft', draftId: draft.id, status: 'tested',
                      })}
                    />
                  ) : null}
                  {draft.status === 'tested' ? (
                    <ActionButton
                      label="Mark ready"
                      disabled={draftPending}
                      onPress={() => void act(`draft-${draft.id}`, {
                        action: 'transition-authoring-draft', draftId: draft.id, status: 'ready',
                      })}
                    />
                  ) : null}
                  {draft.status === 'ready' ? <ActionButton label="Publish" disabled={draftPending} onPress={() => void act(`draft-${draft.id}`, { action: 'publish-authoring-draft', draftId: draft.id })} /> : null}
                  {draft.status !== 'archived' ? <ActionButton label="Archive" secondary disabled={draftPending} onPress={() => Alert.alert('Archive draft?', 'The draft remains recoverable.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void act(`draft-${draft.id}`, { action: 'transition-authoring-draft', draftId: draft.id, status: 'archived' }) }])} /> : null}
                </View>
            </View>
          );
        }) : null}

        {section === 'Quality' ? (
          <View>
            <View style={styles.statGrid}>
              {[
                ['Discovered drinks', qualityStats.totalDiscovered],
                ['Total drafts', qualityStats.totalDrafts],
                ['Missing images', qualityStats.missingImages],
                ['Needs testing', qualityStats.needsTesting],
                ['Missing ingredients', qualityStats.missingIngredients],
                ['Missing steps', qualityStats.missingSteps],
                ['Ready for review', qualityStats.readyForReview],
                ['Published recipes', qualityStats.published],
              ].map(([label, value]) => (
                <View key={label as string} style={styles.statTile}>
                  <DisplayText style={styles.statValue}>{value}</DisplayText>
                  <AppText style={styles.statLabel}>{label}</AppText>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <DisplayText style={styles.cardTitle}>Drafts by source</DisplayText>
              {qualityStats.bySource.map(([source, count]) => (
                <AppText key={source} style={styles.counts}>{source}: {count}</AppText>
              ))}
            </View>
            <View style={styles.card}>
              <DisplayText style={styles.cardTitle}>Drafts by collection</DisplayText>
              {qualityStats.byCollection.length === 0 ? <AppText style={styles.meta}>No collection assignments yet.</AppText> : null}
              {qualityStats.byCollection.map(([collection, count]) => (
                <AppText key={collection} style={styles.counts}>{collection}: {count}</AppText>
              ))}
            </View>
            <AppText style={styles.meta}>Use the Drafts tab filters (source, collection, status, needs testing, missing image, invalid, ready) to drill into any of these counts.</AppText>
          </View>
        ) : null}

        {section === 'Review Queue' ? reviewQueue.map((draft, index) => {
          const missing = draftMissingRequirements(draft);
          return (
            <View key={draft.id} style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.grow}>
                  <DisplayText style={styles.cardTitle}>{index + 1}. {draft.proposed_title}</DisplayText>
                  <AppText style={styles.meta}>{draft.source_name || 'No source'} · {draft.recipe_draft_collections?.map((item) => item.recipe_collections?.title).filter(Boolean).join(', ') || 'No collection'}</AppText>
                </View>
                <StatusPill status={draft.status} />
              </View>
              <AppText style={missing.length ? styles.warning : styles.success}>
                {missing.length ? `Missing: ${missing.join(', ')}` : 'Meets all publish requirements'}
              </AppText>
              <View style={styles.filterRow}>
                <StatusPill status={`test: ${draft.tested ? 'tested' : 'untested'}`} />
                <StatusPill status={`image: ${draft.image_status}`} />
                <StatusPill status={`validation: ${draft.validation_status}`} />
              </View>
              <View style={styles.actions}>
                <ActionButton label="Edit" secondary onPress={() => router.push({ pathname: '/admin/draft/[id]', params: { id: draft.id } })} />
                <ActionButton label="Preview" secondary onPress={() => router.push({ pathname: '/admin/draft/[id]', params: { id: draft.id, preview: '1' } })} />
              </View>
            </View>
          );
        }) : null}

        {section === 'Ingredients' ? <View style={styles.card}><DisplayText style={styles.cardTitle}>New ingredient</DisplayText><AppText style={styles.meta}>Canonical IDs prevent duplicate ingredients. Referenced items are deactivated rather than deleted.</AppText><IngredientCatalogEditor busy={pending === 'new-ingredient'} onSave={(action) => void act('new-ingredient', action)} /></View> : null}
        {section === 'Ingredients' ? data.ingredients.map((item) => <View key={item.id} style={styles.card}><View style={styles.cardHeading}><DisplayText style={styles.cardTitle}>{item.name}</DisplayText><StatusPill status={item.active ? 'active' : 'inactive'} /></View><IngredientCatalogEditor item={item} busy={pending === `ingredient-${item.id}`} onSave={(action) => void act(`ingredient-${item.id}`, action)} /></View>) : null}

        {section === 'Collections' ? <View style={styles.card}><DisplayText style={styles.cardTitle}>New collection</DisplayText><CollectionEditor busy={pending === 'new-collection'} onSave={(action) => void act('new-collection', action)} /></View> : null}
        {section === 'Collections' ? data.collections.map((item) => <View key={item.id} style={styles.card}><View style={styles.cardHeading}><DisplayText style={styles.cardTitle}>{item.title}</DisplayText><StatusPill status={item.active ? 'active' : 'inactive'} /></View><CollectionEditor item={item} busy={pending === `collection-${item.id}`} onSave={(action) => void act(`collection-${item.id}`, action)} /></View>) : null}

        {section === 'Sources' && data.sources.length === 0 ? <AppText style={styles.empty}>No sources configured.</AppText> : null}
        {section === 'Imports' && data.runs.length === 0 ? <AppText style={styles.empty}>No imports have run.</AppText> : null}
        {section === 'Discovered' && data.drinks.length === 0 ? <AppText style={styles.empty}>No drinks discovered.</AppText> : null}
        {section === 'Drafts' && visibleDrafts.length === 0 ? <AppText style={styles.empty}>No recipe drafts match these filters.</AppText> : null}
        {section === 'Review Queue' && reviewQueue.length === 0 ? <AppText style={styles.empty}>Nothing left in the review queue — every draft is published or archived.</AppText> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, justifyContent: 'center' },
  signInCard: { alignSelf: 'center', width: '100%', maxWidth: 480, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  signInTitle: { marginTop: spacing.md, fontSize: 30, lineHeight: 34 },
  signInBody: { marginTop: spacing.sm, lineHeight: 21, color: colors.textSecondary },
  header: { padding: spacing.xl, paddingTop: spacing.xxl, flexDirection: 'row', alignItems: 'flex-start' },
  headerCopy: { flex: 1 },
  headerActions: { marginLeft: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.2, color: colors.sage },
  title: { marginTop: spacing.xs, fontSize: 40, lineHeight: 43 },
  subtitle: { marginTop: spacing.sm, maxWidth: 620, lineHeight: 21, color: colors.textSecondary },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, backgroundColor: colors.surface },
  tabs: { marginHorizontal: spacing.xl, padding: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', borderRadius: radius.button, backgroundColor: colors.surface },
  tab: { flexGrow: 1, flexBasis: 100, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  selectedTab: { backgroundColor: colors.espresso },
  tabText: { fontFamily: font.medium, fontSize: 12, color: colors.textSecondary },
  selectedTabText: { color: colors.white },
  errorBanner: { margin: spacing.xl, marginBottom: 0, padding: spacing.md, flexDirection: 'row', alignItems: 'center', columnGap: spacing.md, borderWidth: 1, borderColor: colors.amber, borderRadius: radius.button, backgroundColor: colors.surface },
  errorText: { flex: 1, color: colors.textSecondary },
  content: { padding: spacing.xl },
  card: { marginBottom: spacing.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', columnGap: spacing.md },
  grow: { flex: 1 },
  cardTitle: { fontSize: 24, lineHeight: 27 },
  statusPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.icedBlue },
  statusText: { fontFamily: font.semibold, fontSize: 11, textTransform: 'capitalize' },
  meta: { marginTop: spacing.sm, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  url: { marginTop: spacing.md, fontSize: 12, lineHeight: 18, color: colors.espresso, textDecorationLine: 'underline' },
  body: { marginTop: spacing.md, lineHeight: 21 },
  counts: { marginTop: spacing.md, lineHeight: 20 },
  warning: { marginTop: spacing.md, color: colors.amber },
  success: { marginTop: spacing.md, color: colors.sage },
  actions: { marginTop: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, backgroundColor: colors.espresso },
  secondaryAction: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionText: { fontFamily: font.semibold, fontSize: 12, color: colors.white },
  secondaryActionText: { color: colors.espresso },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  editor: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  draftTools: { marginBottom: spacing.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  filterRow: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  inputLabel: { marginTop: spacing.md, marginBottom: spacing.sm, fontFamily: font.medium, fontSize: 12 },
  input: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.background, fontFamily: font.body, color: colors.text },
  multiline: { minHeight: 88, paddingVertical: spacing.md, textAlignVertical: 'top' },
  empty: { paddingVertical: spacing.xxl, textAlign: 'center', color: colors.textSecondary },
  checkbox: { width: 24, height: 24, marginRight: spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: colors.background },
  checkboxChecked: { borderColor: colors.espresso, backgroundColor: colors.espresso },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  statTile: { minWidth: 140, flexGrow: 1, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  statValue: { fontSize: 32, lineHeight: 35 },
  statLabel: { marginTop: spacing.xs, fontSize: 12, color: colors.textSecondary },
  exportOutput: { marginTop: spacing.sm, minHeight: 160, fontSize: 11, fontFamily: 'Inter_400Regular' },
});
