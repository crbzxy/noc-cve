import type { IncomingMessage, ServerResponse } from 'node:http'

export function handleCorpusRequest(req: IncomingMessage, res: ServerResponse): boolean
