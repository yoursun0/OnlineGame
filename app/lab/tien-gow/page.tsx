import type { Metadata } from 'next';
import { LabClient } from './lab-client';
import './lab.css';

export const metadata: Metadata = {
  title: '打天九 lab — PLAYROOM',
  robots: { index: false, follow: false },
};

export default async function TienGowLabPage({
  searchParams,
}: {
  searchParams: Promise<{ god?: string | string[] }>;
}) {
  const params = await searchParams;
  const god = Array.isArray(params.god) ? params.god[0] === '1' : params.god === '1';
  return <LabClient god={god} />;
}
