import fs from 'node:fs/promises';

const CACHE_ENABLED = false;

type HandlerResult = string[] | string[][];
type Handler = () => HandlerResult;

const targets = new Map<string, string>();
const handlers = new Map<string, Handler>;

async function cwfTarget(path: string) {
	const data = await fs.readFile(path, 'utf-8');
	const lines = data.split('\n');
	const firstLine = lines[0]?.trim()!;
	const firstLineParts = firstLine.split('cwf:')

	if (firstLineParts.length != 2) {
		console.log('CWF file invalid, first line must start with cwf:');
		throw new Error('CWF file invalid');
	}

	const url = firstLineParts[1]!.trim();
	targets.set(url, lines.slice(1).join('\n'));
}

function cwfHandler(name: string, fn: Handler) {
	handlers.set(name, fn);
}

function evaluateExpression(expr: string, cache: Map<string, HandlerResult>): string {
	const parts = expr.trim().split(' ');
	const handler = parts[0]!;
	const template = parts.slice(1).join(' ');
	let outputArr = [];
	if (cache.has(handler)) {
		outputArr = cache.get(handler)!;
	} else {
		outputArr = (handlers.get(handler)!)();
		if (CACHE_ENABLED) {
			cache.set(handler, outputArr);
		}
	}

	if (!Array.isArray(outputArr[0])) {
		outputArr = [outputArr];
	}

	let totalReplaced = '';

	for (const output of outputArr) {
		let replaced = template;

		while (true) {
			const v = ` ${replaced}`.match(new RegExp(/[^{]\{([0-9])\}/m))!;
			if (v === null) {
				break;
			}
			replaced = `${replaced.slice(0, v.index)}${output[parseInt(v[1]!)]}${replaced.slice(v.index! + v[1]!.length + 2)}`;
		}

		totalReplaced += replaced;
	}

	return totalReplaced;
}

function rewriteTemplate(req: Request, target: string): string {
	let parts = target.split('<cwf>');
	if (parts.length === 1) {
		return target;
	}

	let cache = new Map<string, string[]>();
	do {
		const cwfBlock = parts[1]!;
		const cwfExpr = cwfBlock.split('</cwf>')[0]!;
		const blockRemain = cwfBlock.split('</cwf>').slice(1);
		parts = [parts[0]!, ...blockRemain, ...parts.slice(2)];

		const exprEval = evaluateExpression(cwfExpr, cache);

		parts[0]! = `${parts[0]!}${exprEval}`
		parts = [parts[0]!, ...parts.slice(2)];
	} while (parts.length > 1);

	return parts[0]!;
}

function serveTarget(req: Request, target: string): Response {
	const rewritten = rewriteTemplate(req, target);

	return new Response(rewritten, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
}

function cwfRun() {
	const server = Bun.serve({
		fetch(req: Request) {
			const url = new URL(req.url);
			for (const [path, target] of targets) {
				const pathMatching = path === url.pathname;
				if (pathMatching) {
					return serveTarget(req, target);
				}
			}
			return new Response("Not Found", { status: 404 });
		}
	})

	console.log(`Server running at ${server.url}`);
}


cwfTarget('targets/index.cwf');
cwfTarget('targets/hi.cwf');
cwfTarget('targets/messages.cwf');
cwfHandler('get_message', () => {
	return ['hi', 'hello'];
});
cwfHandler('get_messages', () => {
	return [
		['alice', 'hi bob'],
		['bob', 'hi alice']
	];
});

cwfRun();
