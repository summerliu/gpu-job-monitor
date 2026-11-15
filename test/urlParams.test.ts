import { describe, expect, it } from 'vitest';
import type { JobStatus } from '@/api/types';
import {
    DEFAULT_FILTERS,
    filtersToSearchParams,
    hasActiveFilters,
    parseFilters,
    type JobFilters,
} from '@/lib/urlParams';

describe('parseFilters', () => {
    it('falls back to defaults when the URL has no query', () => {
        expect(parseFilters(new URLSearchParams(''))).toEqual(DEFAULT_FILTERS);
    });

    it('parses a fully specified query', () => {
        const params = new URLSearchParams(
            'q=llama&status=RUNNING,FAILED&node=gpu-node-01&sort=name:asc&page=3&pageSize=100'
        );
        expect(parseFilters(params)).toEqual({
            q: 'llama',
            status: ['RUNNING', 'FAILED'],
            node: 'gpu-node-01',
            sort: 'name:asc',
            page: 3,
            pageSize: 100,
        });
    });

    it('drops unknown status values instead of throwing', () => {
        const params = new URLSearchParams('status=RUNNING,NOT_A_STATUS,FAILED');
        expect(parseFilters(params).status).toEqual(['RUNNING', 'FAILED']);
    });

    it('falls back to the default page for non-positive or non-integer values', () => {
        expect(parseFilters(new URLSearchParams('page=0')).page).toBe(1);
        expect(parseFilters(new URLSearchParams('page=-3')).page).toBe(1);
        expect(parseFilters(new URLSearchParams('page=abc')).page).toBe(1);
        expect(parseFilters(new URLSearchParams('page=2.5')).page).toBe(1);
    });
});

describe('filtersToSearchParams', () => {
    it('omits fields that are already at their default value', () => {
        const params = filtersToSearchParams(DEFAULT_FILTERS);
        expect(params.toString()).toBe('');
    });

    it('only writes the fields that differ from the default', () => {
        const params = filtersToSearchParams({ ...DEFAULT_FILTERS, q: 'bert', page: 2 });
        expect(params.get('q')).toBe('bert');
        expect(params.get('page')).toBe('2');
        expect(params.has('status')).toBe(false);
        expect(params.has('sort')).toBe(false);
    });

    it('round-trips through parseFilters', () => {
        const filters: JobFilters = {
            q: 'resnet',
            status: ['PENDING', 'STOPPING'] as JobStatus[],
            node: 'gpu-node-02',
            sort: 'gpuCount:desc',
            page: 5,
            pageSize: 20,
        };
        const roundTripped = parseFilters(filtersToSearchParams(filters));
        expect(roundTripped).toEqual(filters);
    });
});

describe('hasActiveFilters', () => {
    it('is false when only sort/page/pageSize differ from default', () => {
        expect(hasActiveFilters({ ...DEFAULT_FILTERS, page: 3, sort: 'name:asc' })).toBe(false);
    });

    it('is true when q, status, or node is set', () => {
        expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: 'x' })).toBe(true);
        expect(hasActiveFilters({ ...DEFAULT_FILTERS, status: ['FAILED'] })).toBe(true);
        expect(hasActiveFilters({ ...DEFAULT_FILTERS, node: 'gpu-node-01' })).toBe(true);
    });
});
