import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { errorMessage, useT } from '@/i18n';
import {
  IMAGE_PROVIDERS,
  makeImageProvider,
  makeTextProvider,
  TEXT_PROVIDERS,
  type ImageProviderId,
  type TextProviderId,
} from '@/providers/registry';
import type { ModelInfo } from '@/providers/types';
import { parseRefKey, refKey, shortModelName, useModels, type ModelKind, type ModelRef } from '@/state/models';
import { useSettings } from '@/state/settings';
import { Button, ChipGroup, Label } from './components';
import { colors, ui } from './theme';

/** Nome do modelo atual, para mostrar em chips e linhas. */
export function useCurrentModelLabel(kind: ModelKind): string {
  const settings = useSettings((s) => s.settings);
  const cur = kind === 'text' ? settings.text : settings.image;
  const models = useModels((s) => s.cache[`${kind}:${cur.provider}`]?.models);
  return shortModelName(cur.model, models);
}

/** Painel para escolher provedor + modelo (texto ou imagem). */
export function ModelPicker({ kind, visible, onClose }: { kind: ModelKind; visible: boolean; onClose: () => void }) {
  const t = useT();
  const { settings, keys, update } = useSettings();
  const models = useModels();
  const current = kind === 'text' ? settings.text : settings.image;
  const providers = kind === 'text' ? TEXT_PROVIDERS : IMAGE_PROVIDERS;

  const [provider, setProvider] = useState<string>(current.provider);
  const [list, setList] = useState<ModelInfo[]>([]);
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(
    async (p: string, force = false) => {
      setLoading(true);
      setError('');
      try {
        const fetcher = () =>
          kind === 'text'
            ? makeTextProvider(p as TextProviderId, keys, settings.local).listModels()
            : makeImageProvider(p as ImageProviderId, keys, settings.local).listModels();
        setList(await useModels.getState().fetch(kind, p, fetcher, force));
      } catch (e) {
        setList(useModels.getState().cached(kind, p) ?? []);
        setError(errorMessage(settings.language, e));
      } finally {
        setLoading(false);
      }
    },
    [kind, keys, settings.local, settings.language],
  );

  useEffect(() => {
    if (!visible) return;
    models.load().then(() => {
      setProvider(current.provider);
      setQuery('');
      setManual('');
      loadList(current.provider);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const choose = async (p: string, model: string) => {
    if (!model.trim()) return;
    const ref: ModelRef = { kind, provider: p, model: model.trim() };
    if (kind === 'text') await update({ text: { provider: p as TextProviderId, model: ref.model } });
    else await update({ image: { ...settings.image, provider: p as ImageProviderId, model: ref.model } });
    await models.touch(ref);
    onClose();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((m) => `${m.id} ${m.name}`.toLowerCase().includes(q)) : list;
  }, [list, query]);

  const shortcuts = useMemo(() => {
    const favs = models.favorites.map(parseRefKey).filter((r) => r.kind === kind);
    const recents = models.recents.filter((r) => r.kind === kind && !models.favorites.includes(refKey(r)));
    return { favs, recents };
  }, [models.favorites, models.recents, kind]);

  const renderRow = (r: ModelRef, key: string) => {
    const isCurrent = r.provider === current.provider && r.model === current.model;
    const fav = models.favorites.includes(refKey(r));
    return (
      <View key={key} style={[ui.row, { paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }]}>
        <Pressable style={{ flex: 1 }} onPress={() => choose(r.provider, r.model)}>
          <Text style={[ui.text, isCurrent && { color: colors.accent, fontWeight: '700' }]} numberOfLines={1}>
            {isCurrent ? '● ' : ''}
            {shortModelName(r.model, models.cache[`${kind}:${r.provider}`]?.models)}
          </Text>
          <Text style={ui.muted} numberOfLines={1}>
            {providers[r.provider as keyof typeof providers]?.label ?? r.provider} · {r.model}
          </Text>
        </Pressable>
        <Pressable onPress={() => models.toggleFavorite(r)} hitSlop={10} accessibilityLabel="favorito">
          <Text style={{ fontSize: 20, color: fav ? colors.accent : colors.muted }}>{fav ? '★' : '☆'}</Text>
        </Pressable>
      </View>
    );
  };

  const header = (
    <View style={{ gap: 10, paddingBottom: 8 }}>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.title}>{kind === 'text' ? t('textModel') : t('imageModel')}</Text>
        <Button small kind="ghost" label="✕" onPress={onClose} />
      </View>
      <ChipGroup
        options={Object.keys(providers).map((id) => ({ id, label: providers[id as keyof typeof providers].label }))}
        value={provider}
        onChange={(p) => {
          setProvider(p);
          setQuery('');
          loadList(p);
        }}
      />
      {(shortcuts.favs.length > 0 || shortcuts.recents.length > 0) && (
        <View>
          {shortcuts.favs.length > 0 && <Label>{t('favorites')}</Label>}
          {shortcuts.favs.map((r) => renderRow(r, `f-${refKey(r)}`))}
          {shortcuts.recents.length > 0 && <Label>{t('recents')}</Label>}
          {shortcuts.recents.map((r) => renderRow(r, `r-${refKey(r)}`))}
        </View>
      )}
      <Label>{t('allModels')}</Label>
      <View style={ui.row}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          placeholder={`🔎 ${t('search')}`}
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button small kind="secondary" label="↻" onPress={() => loadList(provider, true)} />
      </View>
      {loading && <ActivityIndicator color={colors.accent} />}
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
    </View>
  );

  const footer = (
    <View style={{ gap: 8, paddingTop: 12 }}>
      <Label>{t('typeModel')}</Label>
      <View style={ui.row}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          placeholder="ex.: openai/gpt-x"
          placeholderTextColor={colors.muted}
          value={manual}
          onChangeText={setManual}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button small label="OK" onPress={() => choose(provider, manual)} disabled={!manual.trim()} />
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0009' }} onPress={onClose} />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '85%', padding: 16 }}>
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={30}
          renderItem={({ item }) => renderRow({ kind, provider, model: item.id }, item.id)}
          ListEmptyComponent={!loading && !error ? <Text style={ui.muted}>{t('noModels')}</Text> : undefined}
        />
      </View>
    </Modal>
  );
}

/** Linha "Modelo: nome ›" que abre o seletor. */
export function ModelRow({ kind }: { kind: ModelKind }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const label = useCurrentModelLabel(kind);
  const provider = useSettings((s) => (kind === 'text' ? s.settings.text.provider : s.settings.image.provider));
  const providers = kind === 'text' ? TEXT_PROVIDERS : IMAGE_PROVIDERS;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[ui.card, ui.row, { padding: 12, backgroundColor: colors.surface2 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[ui.text, { fontWeight: '700' }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={ui.muted} numberOfLines={1}>
            {providers[provider as keyof typeof providers]?.label}
          </Text>
        </View>
        <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('change')} ›</Text>
      </Pressable>
      <ModelPicker kind={kind} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
