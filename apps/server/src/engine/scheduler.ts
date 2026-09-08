/**
 * 定时任务（每日 00:05 东八区）：
 * 1) 资源池自动评估当日推文（§3.1）
 * 2) 待审橱窗（submitted）自动审核（模拟 24h 内出结果）
 * 3) 佣金 T+7 结算 + 订单自动完成
 */
import { db } from '../db/store';
import { nextDailyRunDelay } from '../utils/time';
import { evalPool } from './pool';
import { auditWindow } from './window';
import { settleDueCommissions, autoCompleteReceivedOrders } from './dailyJobs';

let timer: NodeJS.Timeout | null = null;

function runDaily(): void {
  try {
    const pr = evalPool();
    console.log(`[scheduler] 资源池每日评估：日期 ${pr.dateKey}，评估 ${pr.evaluated} 篇，新增入池 ${pr.added.length}`, pr.added.length ? `(${pr.added.map((a) => `post#${a.postId}`).join(',')})` : '');
  } catch (e) {
    console.error('[scheduler] 资源池评估异常', e);
  }
  try {
    // 待审橱窗自动审核
    let n = 0;
    for (const w of db.windows) {
      if (w.status === 'submitted') {
        const r = auditWindow(w);
        console.log(`[scheduler] 橱窗 #${w.id} 自动审核：${r.pass ? '通过→上架' : '拒绝'} ${w.productName}`);
        n++;
      }
    }
    if (!n) console.log('[scheduler] 无待审橱窗');
    db.settings.lastWindowAudit = new Date().toISOString();
  } catch (e) {
    console.error('[scheduler] 橱窗审核异常', e);
  }
  try {
    const settled = settleDueCommissions();
    const completed = autoCompleteReceivedOrders();
    console.log(`[scheduler] 佣金结算 ${settled} 笔，订单自动完成 ${completed} 笔`);
  } catch (e) {
    console.error('[scheduler] 佣金结算异常', e);
  }
}

export function startScheduler(): void {
  if (timer) clearInterval(timer);
  const delay = nextDailyRunDelay(0, 5);
  timer = setTimeout(() => {
    runDaily();
    timer = setInterval(runDaily, 86400000);
    if (timer.unref) timer.unref();
  }, delay);
  if (timer.unref) timer.unref();
  console.log(`[scheduler] 每日 00:05 任务已排定（${(delay / 3600000).toFixed(1)} 小时后首次执行）`);
}
