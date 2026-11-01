/**
 * TanStack Query helpers used by every page: a GET hook that returns the API envelope, and a mutation hook with
 * consistent success and error toasts and cache invalidation.
 *
 * @author Kwasi Adabo Boakye
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from './api.js';
import { clean } from '../hooks/useQueryParams.js';

/**
 * Fetches data from the API with caching. The previous result stays on screen while new parameters load, and empty
 * parameters are dropped from the query string.
 *
 * @param {string|Array<*>} key Query key (or key prefix).
 * @param {string|null} url API path; no request is made while it is empty.
 * @param {object} [params] Query-string parameters.
 * @param {object} [options={}] Extra TanStack Query options.
 * @returns {import('@tanstack/react-query').UseQueryResult} The query; `data` is the envelope `{ data, meta }`.
 */
export function useApi(key, url, params, options = {}) {
  return useQuery({
    queryKey: [...(Array.isArray(key) ? key : [key]), params ?? null],
    queryFn: () => api.get(url, { params: params ? clean(params) : undefined }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: Boolean(url) && options.enabled !== false,
    ...options,
  });
}

/**
 * Wraps a write request: on success it invalidates the given query keys and shows a success toast; on failure it
 * shows the API's error message unless silenced. Field errors stay on the error object for forms to display.
 *
 * @param {(vars: *) => Promise<*>} fn The request to perform.
 * @param {{ success?: string|Function, invalidate?: Array<*>, onSuccess?: Function, onError?: Function,
 *   silentError?: boolean }} [options]
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export function useApiMutation(fn, { success, invalidate = [], onSuccess, onError, silentError } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (res, vars) => {
      for (const k of invalidate) await qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] });
      if (success) toast.success(typeof success === 'function' ? success(res, vars) : success);
      onSuccess?.(res, vars);
    },
    onError: (err, vars) => {
      if (!silentError) toast.error(errorMessage(err));
      onError?.(err, vars);
    },
  });
}

/**
 * Sends a POST request and resolves to the response body.
 *
 * @param {string} url API path.
 * @param {*} [body] Request body.
 * @returns {Promise<*>}
 */
export const post = (url, body) => api.post(url, body).then((r) => r.data);

/**
 * Sends a PATCH request and resolves to the response body.
 *
 * @param {string} url API path.
 * @param {*} [body] Request body.
 * @returns {Promise<*>}
 */
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);

/**
 * Sends a PUT request and resolves to the response body.
 *
 * @param {string} url API path.
 * @param {*} [body] Request body.
 * @returns {Promise<*>}
 */
export const put = (url, body) => api.put(url, body).then((r) => r.data);

/**
 * Sends a DELETE request, with an optional body, and resolves to the response body.
 *
 * @param {string} url API path.
 * @param {*} [body] Request body, for example a reason.
 * @returns {Promise<*>}
 */
export const del = (url, body) => api.delete(url, { data: body }).then((r) => r.data);
