/* ============================================================================
 * /me/preferences 设计偏好标签（本地；V2 不强制走后端）
 * ==========================================================================*/
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { useLocalState } from '../../utils/store';

const STYLE_TAGS = ['法式', '韩系', '简约', '复古', '街头', '甜美', '知性', '职业', '东方', '户外', '通勤', '晚宴', '度假', '学院', '工装', '运动'];
const FABRICS = ['真丝', '棉麻', '羊毛', '醋酸', '针织', '牛仔', '雪纺', '蕾丝'];
const COLORS = ['温柔粉', '奶油白', '燕麦色', '藏青', '焦糖棕', '雾霾蓝', '香芋紫', '军绿'];
const CATEGORIES = ['连衣裙', '衬衫', '半裙', '外套', '裤装', '套装'];

interface Prefs {
  tags: string[];
  fabrics: string[];
  colors: string[];
  categories: string[];
  size?: string;
}

export default function PreferencesPage() {
  const toast = useToast();
  const [prefs, setPrefs] = useLocalState<Prefs>('zm_preferences', { tags: [], fabrics: [], colors: [], categories: [], size: 'M' });

  const toggle = (k: keyof Prefs, v: string) => {
    setPrefs((p) => {
      const arr = (p[k] as string[]) || [];
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
      return { ...p, [k]: next };
    });
  };

  const save = () => {
    toast('偏好已保存，推荐会越来越懂你', 'check');
  };

  return (
    <div className="page no-tab page-bleed">
      <NavBar back title="设计偏好" />
      <div className="page-body" style={{ paddingTop: 4 }}>
        <div className="row" style={{ gap: 9, background: '#fff', borderRadius: 14, padding: '11px 13px', marginBottom: 14, border: '1px solid var(--line)' }}>
          <Icon name="sparkle" size={18} color="var(--brand)" />
          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
            选择你喜欢的风格、面料与色系，首页推荐与商城会优先展示贴近你审美的内容。
          </span>
        </div>

        <ChipGroup title="风格标签" values={prefs.tags} options={STYLE_TAGS} onToggle={(v) => toggle('tags', v)} icon="star" />
        <ChipGroup title="常用面料" values={prefs.fabrics} options={FABRICS} onToggle={(v) => toggle('fabrics', v)} icon="layers" />
        <ChipGroup title="心动色系" values={prefs.colors} options={COLORS} onToggle={(v) => toggle('colors', v)} icon="heart" />
        <ChipGroup title="常购品类" values={prefs.categories} options={CATEGORIES} onToggle={(v) => toggle('categories', v)} icon="tshirt" />

        <div className="card" style={{ padding: 14, marginTop: 14 }}>
          <div className="f-label"><Icon name="ruler" size={15} color="var(--brand)" />日常尺码</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {['XS', 'S', 'M', 'L', 'XL', '均码'].map((s) => (
              <button key={s} onClick={() => setPrefs((p) => ({ ...p, size: s }))} className="size-pick" style={prefs.size === s ? { border: '1.6px solid var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand-deep)' } : {}}>{s}</button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }} onClick={save}>
          <Icon name="check" size={17} />保存偏好
        </button>
      </div>
    </div>
  );
}

function ChipGroup({ title, values, options, onToggle, icon }: { title: string; values: string[]; options: string[]; onToggle: (v: string) => void; icon: 'star' | 'layers' | 'heart' | 'tshirt' }) {
  return (
    <div className="card" style={{ padding: '4px 14px 14px', marginBottom: 12 }}>
      <div className="row" style={{ gap: 6, padding: '12px 0 4px', fontSize: 13.5, fontWeight: 800 }}>
        <Icon name={icon} size={14} color="var(--brand)" />{title}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{values.length} 项</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {options.map((o) => {
          const on = values.includes(o);
          return (
            <button key={o} onClick={() => onToggle(o)} style={{
              padding: '7px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 600,
              background: on ? 'var(--brand-grad)' : '#fff', color: on ? '#fff' : 'var(--text-2)',
              border: `1px solid ${on ? 'transparent' : 'var(--line)'}`,
              boxShadow: on ? '0 3px 10px rgba(232,92,135,.3)' : 'none',
            }}>
              {on ? <span className="row" style={{ gap: 4 }}><Icon name="check" size={12} />{o}</span> : o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
