/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { debounce } from 'lodash-es';
import { useMemo, useEffect, useRef } from 'react';

export function useDebounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
  maxWait?: number
) {
  const funcRef = useRef<T | null>(null);
  funcRef.current = fn;

  const debounceFn = useMemo(
    () =>
      debounce(
        (...args: Parameters<T>) => {
          if (funcRef.current) {
            funcRef.current(...args);
          }
        },
        ms,
        { maxWait }
      ),
    [ms, maxWait]
  );

  useEffect(() => {
    return () => {
      debounceFn.cancel();
    };
  }, [debounceFn]);

  return debounceFn;
}
