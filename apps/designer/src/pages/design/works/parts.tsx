/* =========================================================
 * 作品模块共享件（works/parts.tsx）
 * 同步码规范（StudioPage / WorksDetailPage 共用）：
 *   同步码 = encodeURIComponent(JSON.stringify({app:'dreamweaver-design', v:1, title, params}))
 * 拆分后跨应用：官方App（端口5173）「我的作品集 → 导入设计稿」粘贴同步码导入
 * ========================================================= */
import Icon from '../../../components/Icon';
import { Sheet, useToast } from '../../../components/Sheet';
import type { DesignParams } from '../../../data/design';

/** 生成同步码（标题 + 完整参数序列化 + URL 编码） */
export function makeSyncCode(title: string, params: DesignParams): string {
  return encodeURIComponent(JSON.stringify({ app: 'dreamweaver-design', v: 1, title, params }));
}

interface SyncCodeSheetProps {
  open: boolean;
  onClose: () => void;
  /** makeSyncCode(title, params) 生成的同步码 */
  code: string;
  /** 设计稿名称（展示用） */
  designTitle?: string;
  /** 已确认导入过（按钮态） */
  imported?: boolean;
  /** 点击「我已完成导入」：父级负责 update(id,{status:'synced'}) 并关闭 */
  onImportDone?: () => void;
}

/** 同步至官方App · 同步码弹层 */
export function SyncCodeSheet({ open, onClose, code, designTitle, imported, onImportDone }: SyncCodeSheetProps) {
  const toast = useToast();

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('同步码已复制，去官方App粘贴导入吧', 'copy');
    } catch {
      // 剪贴板不可用时降级：toast 展示内容，用户可长按下方输入框复制
      toast(`复制失败，内容：${code}`, 'copy');
    }
  };

  const confirmDone = () => {
    if (onImportDone) { onImportDone(); return; }
    toast('已确认导入官方App', 'check');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="同步至官方App">
      <div style={{ paddingBottom: 24 }}>
        {/* 操作流程提示 */}
        <div className="row" style={{ alignItems: 'flex-start', gap: 8, background: 'var(--gold-soft)', border: '1px solid rgba(201,162,63,.4)', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, color: '#8A5A00', lineHeight: 1.9 }}>
          <Icon name="send" size={14} style={{ marginTop: 2 }} />
          <span>复制同步码 → 打开官方App「我的作品集 → 导入设计稿」粘贴，即可跨端导入本设计稿。</span>
        </div>

        {designTitle && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)' }}>
            当前设计：<b style={{ color: 'var(--text)' }}>{designTitle}</b>
          </div>
        )}

        <div style={{ marginTop: 14, marginBottom: 6, fontSize: 12, color: 'var(--text-3)' }}>同步码（含品类 / 款式 / 面料参数）</div>
        <textarea
          readOnly
          value={code}
          rows={4}
          onFocus={(e) => { try { e.currentTarget.select(); } catch { /* ignore */ } }}
          style={{
            width: '100%', padding: 10, borderRadius: 10, border: '1px dashed rgba(201,162,63,.6)',
            background: '#FDFAF3', fontSize: 10, lineHeight: 1.7, resize: 'none', outline: 'none',
            color: 'var(--text-2)', wordBreak: 'break-all', whiteSpace: 'pre-wrap',
          }}
        />

        <button onClick={copyCode} className="btn btn-outline btn-block" style={{ marginTop: 12 }}>
          <Icon name="copy" size={16} />复制同步码
        </button>
        <button onClick={confirmDone} disabled={imported} className="btn btn-primary btn-block" style={{ marginTop: 10 }}>
          <Icon name="check-circle" size={16} />{imported ? '已确认导入' : '我已完成导入'}
        </button>

        <div className="row" style={{ justifyContent: 'center', gap: 4, marginTop: 12, fontSize: 11, color: 'var(--text-3)' }}>
          <Icon name="lock" size={11} />正式版将自动云端同步，无需手动粘贴
        </div>
      </div>
    </Sheet>
  );
}
