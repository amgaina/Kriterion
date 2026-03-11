'use client';

import { useMutation, useQueryClient, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import { invalidationGroups } from './query-keys';

type InvalidationGroup = keyof typeof invalidationGroups;

interface UseMutationWithInvalidationOptions<TData, TError, TVariables, TContext>
    extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'onSuccess'> {
    /**
     * Query keys to invalidate on success
     */
    invalidateKeys?: QueryKey[];
    /**
     * Named invalidation groups from query-keys.ts
     */
    invalidateGroups?: InvalidationGroup[];
    /**
     * Original onSuccess callback - called after invalidation
     */
    onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void | Promise<void>;
}

/**
 * A wrapper around useMutation that automatically invalidates related queries on success.
 * This ensures data stays fresh across the app without manual reload.
 * 
 * @example
 * const createCourseMutation = useMutationWithInvalidation({
 *     mutationFn: (data) => apiClient.createCourse(data),
 *     invalidateGroups: ['allCourses'],
 *     onSuccess: () => router.push('/courses'),
 * });
 */
export function useMutationWithInvalidation<
    TData = unknown,
    TError = Error,
    TVariables = void,
    TContext = unknown
>(options: UseMutationWithInvalidationOptions<TData, TError, TVariables, TContext>) {
    const queryClient = useQueryClient();
    const { invalidateKeys = [], invalidateGroups = [], onSuccess, ...mutationOptions } = options;

    return useMutation<TData, TError, TVariables, TContext>({
        ...mutationOptions,
        onSuccess: async (data, variables, context) => {
            // Collect all keys to invalidate
            const keysToInvalidate: QueryKey[] = [...invalidateKeys];
            
            // Add keys from named groups
            invalidateGroups.forEach((groupName) => {
                const groupKeys = invalidationGroups[groupName];
                if (groupKeys) {
                    keysToInvalidate.push(...groupKeys);
                }
            });

            // Invalidate all collected keys in parallel
            await Promise.all(
                keysToInvalidate.map((key) =>
                    queryClient.invalidateQueries({ queryKey: key })
                )
            );

            // Call original onSuccess if provided
            if (onSuccess) {
                await onSuccess(data, variables, context);
            }
        },
    });
}

/**
 * Hook to manually invalidate query groups.
 * Useful for invalidating data from event handlers or effects.
 * 
 * @example
 * const invalidate = useInvalidateQueries();
 * // Later...
 * invalidate.groups(['allCourses', 'allUsers']);
 */
export function useInvalidateQueries() {
    const queryClient = useQueryClient();

    return {
        /**
         * Invalidate specific query keys
         */
        keys: async (keys: QueryKey[]) => {
            await Promise.all(
                keys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
            );
        },
        
        /**
         * Invalidate named groups of queries
         */
        groups: async (groupNames: InvalidationGroup[]) => {
            const keysToInvalidate: QueryKey[] = [];
            groupNames.forEach((groupName) => {
                const groupKeys = invalidationGroups[groupName];
                if (groupKeys) {
                    keysToInvalidate.push(...groupKeys);
                }
            });
            
            await Promise.all(
                keysToInvalidate.map((key) =>
                    queryClient.invalidateQueries({ queryKey: key })
                )
            );
        },
        
        /**
         * Invalidate all queries matching a partial key
         * Useful for invalidating all queries that start with a certain prefix
         */
        matching: async (partialKey: QueryKey) => {
            await queryClient.invalidateQueries({ queryKey: partialKey });
        },
    };
}
