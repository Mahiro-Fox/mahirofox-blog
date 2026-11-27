import { getDictionary } from '@/i18n/dictionary';
import { PassageExperience } from './passage-experience';
import type { PassagePresetId } from './presets';

interface PassagePageProps {
  params: Promise<{ lang: string }>;
}

const PRESET_IDS: PassagePresetId[] = [
  'night',
  'gallery',
  'neon',
  'archive',
  'warp',
  'hall',
];

export default async function PassagePage({ params }: PassagePageProps) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang, 'passage');
  const text = (key: string) => String(dictionary[key] ?? '');

  /** 预设名单独拼一张表，客户端就不用再拼 i18n key */
  const presets = PRESET_IDS.reduce(
    (acc, id) => {
      acc[id] = text(`passage.presets.${id}`);
      return acc;
    },
    {} as Record<PassagePresetId, string>
  );

  return (
    <PassageExperience
      title={text('passage.title')}
      subtitle={text('passage.description')}
      hint={text('passage.hint')}
      loadingLabel={text('passage.loading')}
      emptyLabel={text('passage.no_images')}
      errorLabel={text('common.load_failed')}
      labels={{
        open: text('passage.controls.open'),
        close: text('passage.controls.close'),
        title: text('passage.controls.title'),
        description: text('passage.controls.description'),
        preset: text('passage.controls.preset'),
        presetHint: text('passage.controls.preset_hint'),
        appearance: text('passage.controls.appearance'),
        parameters: text('passage.controls.parameters'),
        presets,
        colorA: text('passage.controls.color_a'),
        colorB: text('passage.controls.color_b'),
        background: text('passage.controls.background'),
        lanes: text('passage.controls.lanes'),
        gap: text('passage.controls.gap'),
        radius: text('passage.controls.radius'),
        photoFill: text('passage.controls.photo_fill'),
        accentFill: text('passage.controls.accent_fill'),
        lineOpacity: text('passage.controls.line_opacity'),
        fog: text('passage.controls.fog'),
        speed: text('passage.controls.speed'),
        boost: text('passage.controls.boost'),
        blur: text('passage.controls.blur'),
        look: text('passage.controls.look'),
        fov: text('passage.controls.fov'),
        hover: text('passage.controls.hover'),
        seed: text('passage.controls.seed'),
        focusOnClick: text('passage.controls.focus_on_click'),
        captions: text('passage.controls.captions'),
        wheel: text('passage.controls.wheel'),
        interactive: text('passage.controls.interactive'),
        paused: text('passage.controls.paused'),
        reset: text('passage.controls.reset'),
      }}
    />
  );
}
