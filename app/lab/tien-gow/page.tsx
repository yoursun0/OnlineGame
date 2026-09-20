import type { Metadata } from 'next';
import { parseLabQuery } from '@playroom/tien-gow';
import { LabClient } from './lab-client';
import './lab.css';

export const metadata: Metadata = {
  title: '打天九 lab — PLAYROOM',
  robots: { index: false, follow: false },
};

export default async function TienGowLabPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = parseLabQuery(await searchParams);
  return <LabClient query={query} />;
}
