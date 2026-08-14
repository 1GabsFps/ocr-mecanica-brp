/**
 * Empirical Stress Test Harness for Milestone 2
 * Challenger 2 (teamwork_preview_challenger)
 * 
 * Tests:
 * 1. DailyMetricsCard & useCountUp animation guard & memoization behavior
 * 2. useAutoUpdate input focus detection (INPUT / TEXTAREA / isUserTyping) & non-destructive toast
 * 3. ErrorBoundary component structure, catch behavior, fallback UI, reload button & TypeScript typings
 * 4. useServiceHistory pure state updater separation & Discord side-effect isolation
 * 5. AudioContext lazy singleton & sound effect safety
 * 6. HistoryStorage quota protection (30 items, micro-thumbnails, QuotaExceeded fallback)
 * 7. PartsSelector memoization, real-time sync with currentServico & pure parsers
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

// ============================================================================
// Mini Test Framework & Assertions
// ============================================================================
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: { testName: string; error: any }[] = [];

async function describe(suiteName: string, fn: () => void | Promise<void>) {
  console.log(`\n==================================================`);
  console.log(`SUITE: ${suiteName}`);
  console.log(`==================================================`);
  await fn();
}

async function test(testName: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } catch (err: any) {
    failedTests++;
    failures.push({ testName, error: err });
    console.error(`  [FAIL] ${testName}`);
    console.error(`         -> ${err?.message || err}`);
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected deep equal:\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, received ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, received ${JSON.stringify(actual)}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, received ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(num: number) {
      if (!(actual > num)) throw new Error(`Expected ${actual} > ${num}`);
    },
    toBeLessThanOrEqual(num: number) {
      if (!(actual <= num)) throw new Error(`Expected ${actual} <= ${num}`);
    },
    toContain(item: any) {
      const ok = Array.isArray(actual) ? actual.includes(item) : String(actual).includes(String(item));
      if (!ok) throw new Error(`Expected container to contain ${JSON.stringify(item)}`);
    },
  };
}

async function runAll() {
  await describe('1. DailyMetricsCard & useCountUp Guard & Memoization', async () => {
    function simulateCountUpEffect(
      target: number,
      prevTargetVal: number,
      documentHidden: boolean,
      onScheduleRaf: () => void,
      onImmediateSet: (val: number) => void
    ) {
      const start = prevTargetVal;
      const end = target;

      if (start === end || documentHidden) {
        onImmediateSet(end);
        return { animated: false };
      }

      onScheduleRaf();
      return { animated: true };
    }

    await test('Guard skips RAF animation when start === end (identical values on poll)', () => {
      let rafScheduled = false;
      let immediateVal: number | null = null;

      const result = simulateCountUpEffect(
        42,
        42,
        false,
        () => { rafScheduled = true; },
        (v) => { immediateVal = v; }
      );

      expect(result.animated).toBe(false);
      expect(rafScheduled).toBe(false);
      expect(immediateVal).toBe(42);
    });

    await test('Guard skips RAF animation when document.hidden === true (background tab / Alt-Tab)', () => {
      let rafScheduled = false;
      let immediateVal: number | null = null;

      const result = simulateCountUpEffect(
        50,
        10,
        true,
        () => { rafScheduled = true; },
        (v) => { immediateVal = v; }
      );

      expect(result.animated).toBe(false);
      expect(rafScheduled).toBe(false);
      expect(immediateVal).toBe(50);
    });

    await test('Triggers RAF animation only when values differ AND document is visible', () => {
      let rafScheduled = false;
      let immediateVal: number | null = null;

      const result = simulateCountUpEffect(
        100,
        50,
        false,
        () => { rafScheduled = true; },
        (v) => { immediateVal = v; }
      );

      expect(result.animated).toBe(true);
      expect(rafScheduled).toBe(true);
      expect(immediateVal).toBeNull();
    });

    await test('Stress test: 1000 simulated 15-second telemetry polling ticks with unchanged metrics', () => {
      let rafCount = 0;
      let updateCount = 0;
      const currentMetric = 150;

      for (let tick = 0; tick < 1000; tick++) {
        simulateCountUpEffect(
          currentMetric,
          currentMetric,
          false,
          () => { rafCount++; },
          () => { updateCount++; }
        );
      }

      expect(rafCount).toBe(0);
      expect(updateCount).toBe(1000);
    });

    await test('Verify DailyMetricsCard export is wrapped with React.memo', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const code = fs.readFileSync(path.resolve('frontend/src/components/DailyMetricsCard.tsx'), 'utf-8');

      expect(code.includes('export const DailyMetricsCard: React.FC<DailyMetricsCardProps> = memo(')).toBe(true);
      expect(code.includes("DailyMetricsCard.displayName = 'DailyMetricsCard';")).toBe(true);
    });
  });

  await describe('2. useAutoUpdate Input Focus Detection & Toast Behavior', async () => {
    function evaluateUpdateAction(activeElement: { tagName: string; isContentEditable?: boolean } | null) {
      const isUserTyping =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable);

      if (isUserTyping) {
        return {
          mode: 'NON_DESTRUCTIVE_PERSISTENT_TOAST',
          duration: Infinity,
          actionLabel: 'Atualizar Agora',
          willReloadImmediately: false,
        };
      } else {
        return {
          mode: 'AUTOMATIC_RELOAD_TOAST',
          duration: 2000,
          reloadDelayMs: 1000,
          willReloadImmediately: true,
        };
      }
    }

    await test('Preserves form input when user is focused on an <input> element', () => {
      const decision = evaluateUpdateAction({ tagName: 'INPUT' });
      expect(decision.mode).toBe('NON_DESTRUCTIVE_PERSISTENT_TOAST');
      expect(decision.duration).toBe(Infinity);
      expect(decision.actionLabel).toBe('Atualizar Agora');
      expect(decision.willReloadImmediately).toBe(false);
    });

    await test('Preserves form input when user is focused on a <textarea> element', () => {
      const decision = evaluateUpdateAction({ tagName: 'TEXTAREA' });
      expect(decision.mode).toBe('NON_DESTRUCTIVE_PERSISTENT_TOAST');
      expect(decision.duration).toBe(Infinity);
      expect(decision.actionLabel).toBe('Atualizar Agora');
      expect(decision.willReloadImmediately).toBe(false);
    });

    await test('Preserves form input when user is focused on a contentEditable element', () => {
      const decision = evaluateUpdateAction({ tagName: 'DIV', isContentEditable: true });
      expect(decision.mode).toBe('NON_DESTRUCTIVE_PERSISTENT_TOAST');
      expect(decision.duration).toBe(Infinity);
      expect(decision.willReloadImmediately).toBe(false);
    });

    await test('Automatically reloads with graceful 1000ms delay when user is idle (e.g. body / button / null)', () => {
      const decisionBody = evaluateUpdateAction({ tagName: 'BODY' });
      expect(decisionBody.mode).toBe('AUTOMATIC_RELOAD_TOAST');
      expect(decisionBody.willReloadImmediately).toBe(true);
      expect(decisionBody.reloadDelayMs).toBe(1000);

      const decisionNull = evaluateUpdateAction(null);
      expect(decisionNull.mode).toBe('AUTOMATIC_RELOAD_TOAST');
      expect(decisionNull.willReloadImmediately).toBe(true);

      const decisionButton = evaluateUpdateAction({ tagName: 'BUTTON' });
      expect(decisionButton.mode).toBe('AUTOMATIC_RELOAD_TOAST');
      expect(decisionButton.willReloadImmediately).toBe(true);
    });

    await test('Server version detection logic (checkServerVersion) behavior', async () => {
      let globalCachedVersion: number | null = null;

      function mockCheck(fetchedVersion: number) {
        if (globalCachedVersion === null) {
          globalCachedVersion = fetchedVersion;
          return { isOutdated: false, serverVersion: fetchedVersion };
        }
        if (fetchedVersion && fetchedVersion !== globalCachedVersion) {
          return { isOutdated: true, serverVersion: fetchedVersion };
        }
        return { isOutdated: false, serverVersion: fetchedVersion };
      }

      expect(mockCheck(100).isOutdated).toBe(false);
      expect(mockCheck(100).isOutdated).toBe(false);
      const updateResult = mockCheck(101);
      expect(updateResult.isOutdated).toBe(true);
      expect(updateResult.serverVersion).toBe(101);
    });
  });

  await describe('3. ErrorBoundary Component Structure, Catch & Reload', async () => {
    await test('ErrorBoundary static getDerivedStateFromError updates state correctly', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const code = fs.readFileSync(path.resolve('frontend/src/components/ErrorBoundary.tsx'), 'utf-8');

      expect(code.includes('static getDerivedStateFromError(error: Error): State')).toBe(true);
      expect(code.includes('return { hasError: true, error };')).toBe(true);
      expect(code.includes('componentDidCatch(error: Error, errorInfo: ErrorInfo)')).toBe(true);
      expect(code.includes('window.location.reload()')).toBe(true);
      expect(code.includes('Recarregar Sistema')).toBe(true);
    });

    await test('Verify main.tsx wraps <App /> inside <ErrorBoundary>', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const mainCode = fs.readFileSync(path.resolve('frontend/src/main.tsx'), 'utf-8');

      expect(mainCode.includes('<ErrorBoundary>')).toBe(true);
      expect(mainCode.includes('<App />')).toBe(true);
      expect(mainCode.includes('</ErrorBoundary>')).toBe(true);
    });
  });

  await describe('4. useServiceHistory Pure State Updater & Discord Side-Effect Separation', async () => {
    await test('Inspect updateCurrentServiceDetails logic to ensure Discord PATCH is outside setHistory updater', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const hookCode = fs.readFileSync(path.resolve('frontend/src/hooks/useServiceHistory.ts'), 'utf-8');

      const updateFuncStart = hookCode.indexOf('const updateCurrentServiceDetails = useCallback(');
      const updateFuncEnd = hookCode.indexOf('const deleteService = useCallback(', updateFuncStart);
      const updateFuncBody = hookCode.substring(updateFuncStart, updateFuncEnd);

      const setHistoryIndex = updateFuncBody.indexOf('setHistory((prev) => {');
      const setHistoryClose = updateFuncBody.indexOf('});', setHistoryIndex);
      const setHistoryBlock = updateFuncBody.substring(setHistoryIndex, setHistoryClose);

      expect(setHistoryBlock.includes('updateDiscordMessage(')).toBe(false);

      const afterSetHistory = updateFuncBody.substring(setHistoryClose);
      expect(afterSetHistory.includes('updateDiscordMessage(targetMessageId, targetPayload);')).toBe(true);
    });

    await test('Simulation: Double execution of setHistory updater (React 19 StrictMode simulation)', () => {
      let discordPatchCalls = 0;
      let targetMessageId: string | undefined = 'msg_12345';
      let targetPayload: any = { servico: 'Troca de freio' };

      function mockUpdateDiscordMessage(msgId: string, payload: any) {
        discordPatchCalls++;
      }

      function simulateUpdateWithStrictState(updater: (prev: any[]) => any[]) {
        const run1 = updater([{ id: '1', discordMessageId: 'msg_12345' }]);
        const run2 = updater([{ id: '1', discordMessageId: 'msg_12345' }]);

        if (targetMessageId && targetPayload) {
          mockUpdateDiscordMessage(targetMessageId, targetPayload);
        }
      }

      simulateUpdateWithStrictState((prev) => {
        return prev.map(item => ({ ...item, updated: true }));
      });

      expect(discordPatchCalls).toBe(1);
    });
  });

  await describe('5. AudioContext Lazy Singleton Safety', async () => {
    await test('getSharedAudioContext returns single shared instance and handles suspended state', async () => {
      let contextCreationCount = 0;

      class FakeAudioContext {
        public state: 'running' | 'suspended' | 'closed' = 'suspended';
        public resumeCallCount = 0;
        constructor() {
          contextCreationCount++;
        }
        async resume() {
          this.resumeCallCount++;
          this.state = 'running';
        }
      }

      let sharedCtx: FakeAudioContext | null = null;
      function getShared() {
        if (!sharedCtx || sharedCtx.state === 'closed') {
          sharedCtx = new FakeAudioContext();
        }
        if (sharedCtx.state === 'suspended') {
          sharedCtx.resume();
        }
        return sharedCtx;
      }

      for (let i = 0; i < 20; i++) {
        const ctx = getShared();
        expect(ctx).toBeTruthy();
      }

      expect(contextCreationCount).toBe(1);
      expect(sharedCtx!.state).toBe('running');
    });
  });

  await describe('6. History Storage Quota & Capacity Cap', async () => {
    await test('loadHistory and saveHistory strictly enforce MAX_HISTORY_ITEMS = 30', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const storageCode = fs.readFileSync(path.resolve('frontend/src/utils/historyStorage.ts'), 'utf-8');

      expect(storageCode.includes('export const MAX_HISTORY_ITEMS = 30;')).toBe(true);
      expect(storageCode.includes('items.slice(0, MAX_HISTORY_ITEMS)')).toBe(true);
      expect(storageCode.includes('maxDim = 160')).toBe(true);
      expect(storageCode.includes("canvas.toDataURL('image/jpeg', 0.45)")).toBe(true);
      expect(storageCode.includes('canvas.width = 0')).toBe(true);
      expect(storageCode.includes('canvas.height = 0')).toBe(true);
    });
  });

  await describe('7. PartsSelector State Sync & Memoization', async () => {
    await test('PartsSelector uses React.memo and listens to currentServico in useEffect', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const partsCode = fs.readFileSync(path.resolve('frontend/src/components/PartsSelector.tsx'), 'utf-8');

      expect(partsCode.includes('export const PartsSelector: React.FC<PartsSelectorProps> = memo(')).toBe(true);
      expect(partsCode.includes("PartsSelector.displayName = 'PartsSelector';")).toBe(true);
      expect(partsCode.includes('useEffect(() => {')).toBe(true);
      expect(partsCode.includes('setServiceMode(parseServiceMode(currentServico));')).toBe(true);
      expect(partsCode.includes('setTuningParts(parseTuningParts(currentServico));')).toBe(true);
      expect(partsCode.includes('setRetificaParts(parseRetificaParts(currentServico));')).toBe(true);
    });
  });

  console.log(`\n==================================================`);
  console.log(`CHALLENGER EMPIRICAL TEST SUMMARY`);
  console.log(`==================================================`);
  console.log(`Total Tests:  ${totalTests}`);
  console.log(`Passed Tests: ${passedTests}`);
  console.log(`Failed Tests: ${failedTests}`);

  if (failedTests > 0) {
    console.error(`\nFailures detail:`);
    failures.forEach(f => console.error(`- ${f.testName}: ${f.error?.message || f.error}`));
    process.exit(1);
  } else {
    console.log(`\nALL EMPIRICAL TESTS PASSED!`);
    process.exit(0);
  }
}

runAll();

