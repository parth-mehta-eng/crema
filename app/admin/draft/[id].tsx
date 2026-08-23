import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText, DisplayText } from '@/components/AppText';
import { LoadingState } from '@/components/LoadingState';
import { Screen } from '@/components/Screen';
import { colors, font, radius, spacing } from '@/constants/theme';
import { getAdminAccess } from '@/services/admin';
import {
  DRAFT_STATUSES,
  INGREDIENT_UNITS,
  RECIPE_CATEGORIES,
  RECIPE_DIFFICULTIES,
  RECIPE_TEMPERATURES,
  formatTimer,
  normalizePositions,
  validateDraft,
  type AuthoringDraft,
  type DraftValidationError,
} from '@/services/authoring/domain';
import {
  duplicateAuthoringDraft,
  loadAuthoringDraft,
  publishAuthoringDraft,
  removeRecipeImage,
  saveAuthoringDraft,
  transitionAuthoringDraft,
  unpublishAuthoringDraft,
  uploadRecipeImage,
  type AuthoringCatalog,
} from '@/services/authoring/repository';

type EditorMode = 'edit' | 'preview';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    return (value === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function Button({ label, onPress, secondary = false, danger = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, danger && styles.buttonDanger, disabled && styles.disabled, pressed && styles.pressed]}>
    <AppText style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{label}</AppText>
  </Pressable>;
}

function Field({ label, value, onChangeText, multiline = false, keyboardType = 'default', error }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; keyboardType?: 'default' | 'numeric' | 'url'; error?: string }) {
  return <View style={styles.field}>
    <AppText style={styles.label}>{label}</AppText>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} keyboardType={keyboardType} autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'} style={[styles.input, multiline && styles.multiline, error && styles.inputError]} />
    {error ? <AppText style={styles.fieldError}>{error}</AppText> : null}
  </View>;
}

function Choices({ label, choices, selected, onSelect, error }: { label: string; choices: readonly { id: string; label: string }[]; selected: string[]; onSelect: (id: string) => void; error?: string }) {
  return <View style={styles.field}>
    <AppText style={styles.label}>{label}</AppText>
    <View style={styles.chips}>{choices.map((choice) => {
      const active = selected.includes(choice.id);
      return <Pressable key={choice.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onSelect(choice.id)} style={[styles.chip, active && styles.chipActive]}>
        <AppText style={[styles.chipText, active && styles.chipTextActive]}>{choice.label}</AppText>
      </Pressable>;
    })}</View>
    {error ? <AppText style={styles.fieldError}>{error}</AppText> : null}
  </View>;
}

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return <View style={styles.section}>
    <DisplayText style={styles.sectionTitle}>{title}</DisplayText>
    {help ? <AppText style={styles.help}>{help}</AppText> : null}
    {children}
  </View>;
}

export default function RecipeDraftEditor() {
  const { id, preview } = useLocalSearchParams<{ id: string; preview?: string }>();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState<AuthoringDraft | null>(null);
  const [catalog, setCatalog] = useState<AuthoringCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<DraftValidationError[]>([]);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<EditorMode>(preview === '1' ? 'preview' : 'edit');
  const [uploadProgress, setUploadProgress] = useState(0);
  const allowLeave = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const access = await getAdminAccess();
      if (!access.isAdmin) throw new Error('Admin access is required.');
      const result = await loadAuthoringDraft(id);
      setDraft(result.draft);
      setCatalog(result.catalog);
      setDirty(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Recipe draft could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const loadTask = setTimeout(() => void load(), 0);
    return () => clearTimeout(loadTask);
  }, [load]);
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!dirty || allowLeave.current) return;
    event.preventDefault();
    Alert.alert('Discard unsaved changes?', 'Your local editor changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { allowLeave.current = true; navigation.dispatch(event.data.action); } },
    ]);
  }), [dirty, navigation]);

  const change = <K extends keyof AuthoringDraft>(key: K, value: AuthoringDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setDirty(true);
  };
  const fieldError = (field: string) => errors.find((item) => item.field === field)?.message;
  const refreshValidation = (candidate = draft) => {
    if (!candidate || !catalog) return [];
    const found = validateDraft(candidate, catalog.existingSlugs);
    setErrors(found);
    return found;
  };
  const save = async () => {
    if (!draft) return false;
    setBusy('save'); setError(null);
    try {
      const version = await saveAuthoringDraft(draft);
      setDraft({ ...draft, version });
      setDirty(false);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Draft could not be saved.');
      return false;
    } finally { setBusy(null); }
  };
  const saveThenTransition = async (status: 'draft' | 'tested' | 'ready' | 'archived') => {
    if (!draft) return;
    if (status === 'ready' && refreshValidation().length) return;
    if (dirty && !(await save())) return;
    setBusy(status); setError(null);
    try { await transitionAuthoringDraft(draft.id, status); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Status could not be changed.'); }
    finally { setBusy(null); }
  };
  const publish = async () => {
    if (!draft) return;
    const found = refreshValidation();
    if (found.length || draft.status !== 'ready') {
      setError(found.length ? 'Publishing is blocked until every validation issue is resolved.' : 'Mark this tested draft ready before publishing.');
      return;
    }
    if (dirty && !(await save())) return;
    setBusy('publish'); setError(null);
    try { await publishAuthoringDraft(draft.id); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Publish failed and no partial changes were committed.'); }
    finally { setBusy(null); }
  };
  const unpublish = () => draft && Alert.alert('Unpublish recipe?', 'The public recipe will disappear from mobile queries. The draft will remain editable.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Unpublish', style: 'destructive', onPress: async () => {
      setBusy('unpublish'); try { await unpublishAuthoringDraft(draft.id); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unpublish failed.'); } finally { setBusy(null); }
    } },
  ]);
  const duplicate = async () => {
    if (!draft) return;
    setBusy('duplicate');
    try {
      const created = await duplicateAuthoringDraft(draft.id);
      allowLeave.current = true;
      router.replace({ pathname: '/admin/draft/[id]', params: { id: created.id } });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Draft could not be duplicated.'); }
    finally { setBusy(null); }
  };
  const pickImage = async () => {
    if (!draft) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo library permission is required to choose a recipe image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.9 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const extension = asset.fileName?.split('.').pop() ?? mimeType.split('/')[1] ?? 'jpg';
    setBusy('image'); setUploadProgress(20); setError(null);
    try {
      const uploaded = await uploadRecipeImage(draft.id, asset.uri, mimeType, extension);
      setUploadProgress(100);
      change('heroImageUrl', uploaded.url); change('heroImagePath', uploaded.path); change('heroImageMime', uploaded.mimeType); change('heroImageBytes', uploaded.bytes);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Image upload failed.'); }
    finally { setBusy(null); setTimeout(() => setUploadProgress(0), 700); }
  };
  const clearImage = async () => {
    if (!draft) return;
    setBusy('image');
    try { await removeRecipeImage(draft.heroImagePath ?? ''); change('heroImageUrl', ''); change('heroImagePath', ''); change('heroImageMime', ''); change('heroImageBytes', null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Image could not be removed.'); }
    finally { setBusy(null); }
  };

  const updateIngredient = (index: number, values: Partial<AuthoringDraft['ingredients'][number]>) => draft && change('ingredients', draft.ingredients.map((row, rowIndex) => rowIndex === index ? { ...row, ...values } : row));
  const updateStep = (index: number, values: Partial<AuthoringDraft['steps'][number]>) => draft && change('steps', draft.steps.map((row, rowIndex) => rowIndex === index ? { ...row, ...values } : row));
  const move = <T extends { position: number }>(items: T[], index: number, direction: -1 | 1, key: 'ingredients' | 'steps') => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const copy = [...items]; [copy[index], copy[target]] = [copy[target]!, copy[index]!];
    change(key, normalizePositions(copy) as unknown as AuthoringDraft[typeof key]);
  };

  if (loading) return <Screen><LoadingState label="Loading recipe editor" /></Screen>;
  if (!draft || !catalog) return <Screen contentStyle={styles.center}><DisplayText style={styles.title}>Recipe editor unavailable</DisplayText><AppText style={styles.error}>{error}</AppText><Button label="Back to admin" onPress={() => router.back()} /></Screen>;

  const editable = draft.status !== 'published' && draft.status !== 'archived';
  const ingredientNames = new Map(catalog.ingredients.map((item) => [item.id, item.name]));
  const equipmentNames = new Map(catalog.equipment.map((item) => [item.id, item.name]));
  const previewWidth = Math.min(440, width - spacing.xl * 2);

  if (mode === 'preview') return <Screen>
    <View style={styles.header}><Button label="Back to editor" secondary onPress={() => setMode('edit')} /><View style={styles.grow} /><AppText style={styles.status}>{draft.status}</AppText></View>
    <View style={[styles.preview, { width: previewWidth }]}>
      {draft.heroImageUrl ? <Image source={draft.heroImageUrl} accessibilityLabel={draft.heroImageAlt || draft.proposedTitle} style={styles.previewImage} contentFit="cover" /> : <View style={[styles.previewImage, styles.imagePlaceholder]}><Ionicons name="image-outline" size={42} color={colors.textMuted} /></View>}
      <View style={styles.previewBody}>
        <AppText style={styles.eyebrow}>{draft.inspirationLabel}</AppText><DisplayText style={styles.previewTitle}>{draft.proposedTitle || 'Untitled recipe'}</DisplayText><AppText style={styles.description}>{draft.description}</AppText>
        <View style={styles.chips}>{draft.tagIds.map((tag) => <View key={tag} style={styles.previewTag}><AppText style={styles.chipText}>{catalog.tags.find((item) => item.id === tag)?.name ?? tag}</AppText></View>)}</View>
        <View style={styles.previewMeta}><AppText>{draft.totalMinutes || '—'} min</AppText><AppText>{draft.difficulty || '—'}</AppText><AppText>{draft.servings || '—'} serving</AppText></View>
        <DisplayText style={styles.previewHeading}>Ingredients</DisplayText>{draft.ingredients.map((row) => <AppText key={row.id} style={styles.previewRow}>{row.quantity} {row.unit} {row.displayName || ingredientNames.get(row.ingredientId)}{row.preparationNote ? `, ${row.preparationNote}` : ''}</AppText>)}
        <DisplayText style={styles.previewHeading}>Equipment</DisplayText>{draft.equipment.map((row) => <AppText key={row.equipmentId} style={styles.previewRow}>{equipmentNames.get(row.equipmentId)}{row.optional ? ' (optional)' : ''}</AppText>)}
        <DisplayText style={styles.previewHeading}>Steps</DisplayText>{draft.steps.map((step) => <View key={step.id} style={styles.previewStep}><View style={styles.stepNumber}><AppText>{step.position}</AppText></View><View style={styles.grow}><AppText>{step.instruction}</AppText>{step.timerSeconds ? <AppText style={styles.help}>{formatTimer(step.timerSeconds)}</AppText> : null}{step.tip ? <AppText style={styles.tip}>Tip: {step.tip}</AppText> : null}</View></View>)}
        <View style={styles.startMaking}><AppText style={styles.buttonText}>Start Making</AppText></View>
      </View>
    </View>
  </Screen>;

  return <Screen>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back to admin" onPress={() => router.back()} style={styles.iconButton}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
      <View style={styles.headerCopy}><AppText style={styles.eyebrow}>PRIVATE RECIPE AUTHORING</AppText><DisplayText style={styles.title}>{draft.proposedTitle || 'Untitled draft'}</DisplayText><AppText style={styles.help}>Version {draft.version} · {dirty ? 'Unsaved changes' : 'Saved'} · {draft.publishedRecipeId ? `Public ID ${draft.publishedRecipeId}` : 'Not published'}</AppText></View>
      <Button label="Preview" secondary onPress={() => setMode('preview')} />
    </View>
    {error ? <View style={styles.errorBanner}><Ionicons name="alert-circle" size={20} color={colors.amber} /><AppText style={styles.errorBannerText}>{error}</AppText></View> : null}
    {errors.length ? <View style={styles.validation}><AppText style={styles.validationTitle}>{errors.length} issue{errors.length === 1 ? '' : 's'} block readiness/publishing</AppText>{errors.map((item, index) => <AppText key={`${item.field}-${index}`} style={styles.validationItem}>• {item.message}</AppText>)}</View> : null}
    <View style={styles.lifecycle}><AppText style={styles.label}>Lifecycle</AppText><View style={styles.chips}>{DRAFT_STATUSES.map((status) => <View key={status} style={[styles.lifecycleStep, draft.status === status && styles.lifecycleCurrent]}><AppText style={styles.chipText}>{status}</AppText></View>)}</View></View>

    <View pointerEvents={editable ? 'auto' : 'none'} style={!editable && styles.readOnly}>
      <Section title="Basic information">
        <Field label="Recipe title" value={draft.proposedTitle} onChangeText={(value) => change('proposedTitle', value)} error={fieldError('proposedTitle')} />
        <Field label="Slug" value={draft.slug} onChangeText={(value) => change('slug', value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))} error={fieldError('slug')} />
        <Field label="Short description" value={draft.description} onChangeText={(value) => change('description', value)} multiline error={fieldError('description')} />
        <Field label="Inspiration label" value={draft.inspirationLabel} onChangeText={(value) => change('inspirationLabel', value)} />
        <Field label="Source name" value={draft.sourceName} onChangeText={(value) => change('sourceName', value)} error={fieldError('sourceName')} />
        <Field label="Source URL" value={draft.sourceUrl} onChangeText={(value) => change('sourceUrl', value)} keyboardType="url" error={fieldError('sourceUrl')} />
        <Choices label="Collections" choices={catalog.collections.filter((item) => item.active).map((item) => ({ id: item.id, label: item.title }))} selected={draft.collectionIds} onSelect={(value) => change('collectionIds', draft.collectionIds.includes(value) ? draft.collectionIds.filter((id) => id !== value) : [...draft.collectionIds, value])} />
        <Choices label="Featured" choices={[{ id: 'featured', label: 'Featured recipe' }]} selected={draft.featured ? ['featured'] : []} onSelect={() => change('featured', !draft.featured)} />
      </Section>

      <Section title="Classification and metadata">
        <Choices label="Category" choices={RECIPE_CATEGORIES.map((value) => ({ id: value, label: value }))} selected={[draft.category]} onSelect={(value) => change('category', value)} error={fieldError('category')} />
        <Choices label="Temperature" choices={RECIPE_TEMPERATURES.map((value) => ({ id: value, label: value }))} selected={[draft.temperature]} onSelect={(value) => change('temperature', value)} error={fieldError('temperature')} />
        <Choices label="Difficulty" choices={RECIPE_DIFFICULTIES.map((value) => ({ id: value, label: value }))} selected={[draft.difficulty]} onSelect={(value) => change('difficulty', value)} error={fieldError('difficulty')} />
        <View style={styles.grid}>
          <Field label="Prep minutes" value={draft.prepMinutes ? String(draft.prepMinutes) : ''} onChangeText={(value) => change('prepMinutes', Number(value) || 0)} keyboardType="numeric" error={fieldError('prepMinutes')} />
          <Field label="Total minutes" value={draft.totalMinutes ? String(draft.totalMinutes) : ''} onChangeText={(value) => change('totalMinutes', Number(value) || 0)} keyboardType="numeric" error={fieldError('totalMinutes')} />
          <Field label="Servings" value={draft.servings ? String(draft.servings) : ''} onChangeText={(value) => change('servings', Number(value) || 0)} keyboardType="numeric" error={fieldError('servings')} />
          <Field label="Cup size" value={draft.cupSize} onChangeText={(value) => change('cupSize', value)} />
          <Field label="Sweetness 1–5" value={draft.sweetness ? String(draft.sweetness) : ''} onChangeText={(value) => change('sweetness', value ? Number(value) : null)} keyboardType="numeric" />
          <Field label="Strength 1–5" value={draft.strength ? String(draft.strength) : ''} onChangeText={(value) => change('strength', value ? Number(value) : null)} keyboardType="numeric" />
          <Field label="Caffeine mg (optional)" value={draft.caffeineMg == null ? '' : String(draft.caffeineMg)} onChangeText={(value) => change('caffeineMg', value ? Number(value) : null)} keyboardType="numeric" />
          <Field label="Calories (optional)" value={draft.calories == null ? '' : String(draft.calories)} onChangeText={(value) => change('calories', value ? Number(value) : null)} keyboardType="numeric" />
        </View>
      </Section>

      <Section title="Hero image" help="Owned or licensed JPEG, PNG, or WebP · maximum 5 MB · portrait / 4:5 preferred">
        {draft.heroImageUrl ? <Image source={draft.heroImageUrl} accessibilityLabel={draft.heroImageAlt || 'Recipe image preview'} style={styles.editorImage} contentFit="cover" /> : <View style={[styles.editorImage, styles.imagePlaceholder]}><Ionicons name="images-outline" size={38} color={colors.textMuted} /></View>}
        {busy === 'image' || uploadProgress ? <View style={styles.upload}><ActivityIndicator color={colors.espresso} /><AppText>Uploading… {uploadProgress}%</AppText></View> : null}
        <Field label="Accessible image alt text" value={draft.heroImageAlt} onChangeText={(value) => change('heroImageAlt', value)} error={fieldError('heroImageAlt')} />
        <View style={styles.actions}><Button label={draft.heroImageUrl ? 'Replace image' : 'Upload image'} onPress={() => void pickImage()} disabled={busy === 'image'} />{draft.heroImageUrl ? <Button label="Remove image" secondary danger onPress={() => void clearImage()} /> : null}</View>
        {fieldError('heroImageUrl') ? <AppText style={styles.fieldError}>{fieldError('heroImageUrl')}</AppText> : null}
      </Section>

      <Section title="Ingredients" help="Canonical ingredients stay structured. Repeated ingredients require a meaningful display name or preparation difference.">
        {draft.ingredients.map((row, index) => <View key={row.id} style={styles.repeatCard}>
          <View style={styles.repeatHeader}><AppText style={styles.repeatTitle}>Ingredient {index + 1}</AppText><View style={styles.actionsInline}><Button label="↑" secondary disabled={index === 0} onPress={() => move(draft.ingredients, index, -1, 'ingredients')} /><Button label="↓" secondary disabled={index === draft.ingredients.length - 1} onPress={() => move(draft.ingredients, index, 1, 'ingredients')} /><Button label="Remove" secondary danger onPress={() => change('ingredients', normalizePositions(draft.ingredients.filter((_, itemIndex) => itemIndex !== index)))} /></View></View>
          <Choices label="Canonical ingredient" choices={catalog.ingredients.filter((item) => item.active).map((item) => ({ id: item.id, label: item.name }))} selected={[row.ingredientId]} onSelect={(value) => updateIngredient(index, { ingredientId: value, unit: catalog.ingredients.find((item) => item.id === value)?.defaultUnit ?? row.unit })} error={fieldError(`ingredients.${index}.ingredientId`)} />
          <View style={styles.grid}><Field label="Quantity" value={row.quantity ? String(row.quantity) : ''} onChangeText={(value) => updateIngredient(index, { quantity: Number(value) || 0 })} keyboardType="numeric" error={fieldError(`ingredients.${index}.quantity`)} /><Field label="Custom display name" value={row.displayName} onChangeText={(value) => updateIngredient(index, { displayName: value })} /></View>
          <Choices label="Unit" choices={INGREDIENT_UNITS.map((value) => ({ id: value, label: value }))} selected={[row.unit]} onSelect={(value) => updateIngredient(index, { unit: value })} error={fieldError(`ingredients.${index}.unit`)} />
          <Field label="Preparation note" value={row.preparationNote} onChangeText={(value) => updateIngredient(index, { preparationNote: value })} />
          <Field label="Substitution notes" value={row.substitutionNotes} onChangeText={(value) => updateIngredient(index, { substitutionNotes: value })} />
          <Choices label="Optional" choices={[{ id: 'optional', label: 'Optional ingredient' }]} selected={row.optional ? ['optional'] : []} onSelect={() => updateIngredient(index, { optional: !row.optional })} />
          {fieldError(`ingredients.${index}`) ? <AppText style={styles.fieldError}>{fieldError(`ingredients.${index}`)}</AppText> : null}
        </View>)}
        <Button label="Add ingredient" secondary onPress={() => change('ingredients', [...draft.ingredients, { id: uuid(), ingredientId: '', displayName: '', quantity: 1, unit: 'oz', preparationNote: '', optional: false, substitutionNotes: '', position: draft.ingredients.length + 1 }])} />
        {fieldError('ingredients') ? <AppText style={styles.fieldError}>{fieldError('ingredients')}</AppText> : null}
      </Section>

      <Section title="Steps" help="Steps auto-renumber after reordering; timers are stored as seconds.">
        {draft.steps.map((step, index) => <View key={step.id} style={styles.repeatCard}>
          <View style={styles.repeatHeader}><AppText style={styles.repeatTitle}>Step {index + 1}</AppText><View style={styles.actionsInline}><Button label="↑" secondary disabled={index === 0} onPress={() => move(draft.steps, index, -1, 'steps')} /><Button label="↓" secondary disabled={index === draft.steps.length - 1} onPress={() => move(draft.steps, index, 1, 'steps')} /><Button label="Remove" secondary danger onPress={() => change('steps', normalizePositions(draft.steps.filter((_, itemIndex) => itemIndex !== index)))} /></View></View>
          <Field label="Instruction" value={step.instruction} onChangeText={(value) => updateStep(index, { instruction: value })} multiline error={fieldError(`steps.${index}.instruction`)} />
          <Field label="Timer seconds (optional)" value={step.timerSeconds == null ? '' : String(step.timerSeconds)} onChangeText={(value) => updateStep(index, { timerSeconds: value ? Number(value) : null })} keyboardType="numeric" error={fieldError(`steps.${index}.timerSeconds`)} />
          <AppText style={styles.help}>{formatTimer(step.timerSeconds)}</AppText>
          <Field label="Tip (optional)" value={step.tip} onChangeText={(value) => updateStep(index, { tip: value })} />
          <Choices label="Referenced ingredients" choices={draft.ingredients.map((item) => ({ id: item.id, label: item.displayName || ingredientNames.get(item.ingredientId) || `Ingredient ${item.position}` }))} selected={step.ingredientRowIds} onSelect={(value) => updateStep(index, { ingredientRowIds: step.ingredientRowIds.includes(value) ? step.ingredientRowIds.filter((item) => item !== value) : [...step.ingredientRowIds, value] })} />
        </View>)}
        <Button label="Add step" secondary onPress={() => change('steps', [...draft.steps, { id: uuid(), instruction: '', timerSeconds: null, tip: '', ingredientRowIds: [], position: draft.steps.length + 1 }])} />
        {fieldError('steps') ? <AppText style={styles.fieldError}>{fieldError('steps')}</AppText> : null}
      </Section>

      <Section title="Equipment">
        <Choices label="Select equipment" choices={catalog.equipment.map((item) => ({ id: item.id, label: item.name }))} selected={draft.equipment.map((item) => item.equipmentId)} onSelect={(value) => change('equipment', draft.equipment.some((item) => item.equipmentId === value) ? normalizePositions(draft.equipment.filter((item) => item.equipmentId !== value)) : [...draft.equipment, { equipmentId: value, optional: false, alternativeNote: '', position: draft.equipment.length + 1 }])} error={fieldError('equipment')} />
        {draft.equipment.map((item, index) => <View key={item.equipmentId} style={styles.equipmentEditor}><AppText style={styles.grow}>{equipmentNames.get(item.equipmentId)}</AppText><Button label={item.optional ? 'Optional' : 'Required'} secondary={item.optional} onPress={() => change('equipment', draft.equipment.map((row, rowIndex) => rowIndex === index ? { ...row, optional: !row.optional } : row))} /><TextInput accessibilityLabel={`Alternative for ${equipmentNames.get(item.equipmentId)}`} placeholder="Alternative equipment note" value={item.alternativeNote} onChangeText={(value) => change('equipment', draft.equipment.map((row, rowIndex) => rowIndex === index ? { ...row, alternativeNote: value } : row))} style={[styles.input, styles.grow]} /></View>)}
      </Section>

      <Section title="Tags and flavor notes">
        <Choices label="Controlled tags" choices={catalog.tags.filter((item) => item.active).map((item) => ({ id: item.id, label: item.name }))} selected={draft.tagIds} onSelect={(value) => change('tagIds', draft.tagIds.includes(value) ? draft.tagIds.filter((item) => item !== value) : [...draft.tagIds, value])} />
        <AppText style={styles.help}>Flavor notes are normalized from selected tags when published; discovery notes remain visible here: {draft.flavorNotes.join(', ') || 'none'}.</AppText>
      </Section>
    </View>

    <View style={styles.stickyActions}>
      <Button label="Validate" secondary onPress={() => void refreshValidation()} />
      <Button label="Save draft" onPress={() => void save()} disabled={!editable || busy !== null} />
      {draft.status === 'draft' ? <Button label="Mark tested" onPress={() => void saveThenTransition('tested')} disabled={busy !== null} /> : null}
      {draft.status === 'tested' ? <Button label="Mark ready" onPress={() => void saveThenTransition('ready')} disabled={busy !== null} /> : null}
      {draft.status === 'ready' ? <Button label="Publish" onPress={() => void publish()} disabled={busy !== null} /> : null}
      {draft.status === 'published' ? <Button label="Edit as draft" onPress={() => void saveThenTransition('draft')} disabled={busy !== null} /> : null}
      {draft.status === 'published' ? <Button label="Unpublish" secondary danger onPress={unpublish} disabled={busy !== null} /> : null}
      {draft.status === 'archived' ? <Button label="Restore draft" onPress={() => void saveThenTransition('draft')} disabled={busy !== null} /> : null}
      {draft.status !== 'archived' ? <Button label="Archive" secondary danger onPress={() => Alert.alert('Archive draft?', 'The draft stays recoverable and any linked public recipe will be hidden.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void saveThenTransition('archived') }])} /> : null}
      <Button label="Duplicate" secondary onPress={() => void duplicate()} disabled={busy !== null} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  header: { padding: spacing.xl, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerCopy: { flex: 1 }, grow: { flex: 1 }, eyebrow: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.sage },
  title: { marginTop: spacing.xs, fontSize: 36, lineHeight: 40 }, description: { marginTop: spacing.md, lineHeight: 22, color: colors.textSecondary },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, backgroundColor: colors.surface },
  button: { minHeight: 42, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, backgroundColor: colors.espresso },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, buttonDanger: { borderColor: colors.amber },
  buttonText: { fontFamily: font.semibold, fontSize: 12, color: colors.white }, buttonSecondaryText: { color: colors.espresso }, disabled: { opacity: 0.4 }, pressed: { opacity: 0.72 },
  error: { marginVertical: spacing.lg, color: colors.amber }, errorBanner: { marginHorizontal: spacing.xl, marginBottom: spacing.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderColor: colors.amber, borderRadius: radius.sm, backgroundColor: colors.surface }, errorBannerText: { flex: 1 },
  validation: { marginHorizontal: spacing.xl, marginBottom: spacing.md, padding: spacing.lg, borderRadius: radius.card, backgroundColor: '#FFF1DF' }, validationTitle: { fontFamily: font.semibold, color: colors.espresso }, validationItem: { marginTop: spacing.xs, color: colors.textSecondary },
  lifecycle: { marginHorizontal: spacing.xl, marginBottom: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface }, lifecycleStep: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.background }, lifecycleCurrent: { backgroundColor: colors.icedBlue }, status: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textTransform: 'capitalize', borderRadius: radius.pill, backgroundColor: colors.icedBlue },
  section: { marginHorizontal: spacing.xl, marginBottom: spacing.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface }, sectionTitle: { fontSize: 27, lineHeight: 30 }, help: { marginTop: spacing.xs, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  field: { marginTop: spacing.lg, flexGrow: 1, flexBasis: 220 }, label: { marginBottom: spacing.sm, fontFamily: font.semibold, fontSize: 12 }, input: { minHeight: 46, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.background, fontFamily: font.body, color: colors.text }, multiline: { minHeight: 92, paddingVertical: spacing.md, textAlignVertical: 'top' }, inputError: { borderColor: colors.amber }, fieldError: { marginTop: spacing.sm, fontSize: 12, color: colors.amber },
  chips: { marginTop: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { minHeight: 36, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.background }, chipActive: { borderColor: colors.espresso, backgroundColor: colors.icedBlue }, chipText: { fontFamily: font.medium, fontSize: 11, textTransform: 'capitalize' }, chipTextActive: { color: colors.espresso },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, actions: { marginTop: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, actionsInline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  repeatCard: { marginTop: spacing.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.button, backgroundColor: colors.background }, repeatHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, repeatTitle: { flex: 1, fontFamily: font.semibold },
  equipmentEditor: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }, readOnly: { opacity: 0.65 },
  editorImage: { width: 240, height: 300, marginTop: spacing.lg, borderRadius: radius.card, backgroundColor: colors.border }, imagePlaceholder: { alignItems: 'center', justifyContent: 'center' }, upload: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stickyActions: { marginHorizontal: spacing.xl, padding: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, borderRadius: radius.card, backgroundColor: colors.icedBlue },
  preview: { alignSelf: 'center', marginBottom: spacing.xxl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.modal, backgroundColor: colors.surface }, previewImage: { width: '100%', aspectRatio: 4 / 5, maxHeight: 500 }, previewBody: { padding: spacing.xl }, previewTitle: { marginTop: spacing.sm, fontSize: 38, lineHeight: 40 }, previewTag: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.icedBlue }, previewMeta: { marginTop: spacing.xl, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', borderRadius: radius.card, backgroundColor: colors.background }, previewHeading: { marginTop: spacing.xxl, marginBottom: spacing.md, fontSize: 28 }, previewRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, previewStep: { marginBottom: spacing.lg, flexDirection: 'row', gap: spacing.md }, stepNumber: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.icedBlue }, tip: { marginTop: spacing.xs, color: colors.sage }, startMaking: { minHeight: 56, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, backgroundColor: colors.espresso },
});
