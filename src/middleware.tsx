import { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  createDropInBlogCore,
  DropInBlogConfig,
  buildHeadDescriptors,
  normalizePathname,
  type HeadDescriptor,
} from '@dropinblog/react-core';
import { renderHeadTags } from './utils';

export interface DropInBlogExpressOptions extends DropInBlogConfig {
  renderHtml?: (options: {
    content: string;
    headDescriptors: HeadDescriptor[];
    pathname: string;
  }) => string;
  onError?: (error: Error, req: Request, res: Response) => void;
  notFoundHandler?: RequestHandler;
}

export function createDropInBlogExpressMiddleware(
  options: DropInBlogExpressOptions = {}
): RequestHandler {
  const { renderHtml, onError, notFoundHandler, ...config } = options;
  const { router, client, config: resolvedConfig } = createDropInBlogCore(config);
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const basePathPattern = escapeRegExp(resolvedConfig.basePath);
  const sitemapPath = normalizePathname(`${resolvedConfig.basePath}/sitemap.xml`);
  const feedPattern = new RegExp(
    `^${basePathPattern}/feed(?:\\.(?:xml|rss))?/?$`,
    'i'
  );
  const categoryFeedPattern = new RegExp(
    `^${basePathPattern}/feed/category/([^/]+)(?:\.(?:xml|rss))?/?$`,
    'i'
  );
  const authorFeedPattern = new RegExp(
    `^${basePathPattern}/feed/author/([^/]+)(?:\.(?:xml|rss))?/?$`,
    'i'
  );

  return async (req: Request, res: Response, next: NextFunction) => {

    const rawPath = req.originalUrl?.split('?')[0] ?? req.path;
    const pathname = normalizePathname(rawPath);

    const sendXmlResponse = async (
      fetcher: () => Promise<{
        content_type?: string;
        sitemap?: string;
        feed?: string;
        body_html?: string;
      }>,
      notFoundMessage: string
    ) => {
      const payload = await fetcher();
      const content = payload.sitemap ?? payload.feed ?? payload.body_html;
      if (!content) {
        res.status(404).send(notFoundMessage);
        return true;
      }
      res.setHeader(
        'Content-Type',
        payload.content_type ?? 'application/xml; charset=utf-8'
      );
      res.send(content);
      return true;
    };

    try {
      if (pathname === sitemapPath) {
        await sendXmlResponse(() => client.fetchSitemap(), 'Sitemap not available');
        return;
      }

      if (feedPattern.test(pathname)) {
        await sendXmlResponse(() => client.fetchFeed(), 'Feed not available');
        return;
      }

      const categoryFeedMatch = categoryFeedPattern.exec(pathname);
      if (categoryFeedMatch) {
        const slug = decodeURIComponent(categoryFeedMatch[1]);
        await sendXmlResponse(
          () => client.fetchCategoryFeed(slug),
          `No feed available for category "${slug}"`
        );
        return;
      }

      const authorFeedMatch = authorFeedPattern.exec(pathname);
      if (authorFeedMatch) {
        const slug = decodeURIComponent(authorFeedMatch[1]);
        await sendXmlResponse(
          () => client.fetchAuthorFeed(slug),
          `No feed available for author "${slug}"`
        );
        return;
      }

      const match = router.match(pathname);

      if (!match) {
        if (notFoundHandler) {
          return notFoundHandler(req, res, next);
        }
        return next();
      }

      const resolution = await router.resolve(pathname);
      const { payload } = resolution;

      const content = payload.body_html ?? '';
      const headDescriptors = buildHeadDescriptors(
        payload.head_data,
        payload.head_items
      );

      if (renderHtml) {
        const html = renderHtml({ content, headDescriptors, pathname });
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
      }

      const headTags = renderHeadTags(headDescriptors);

      const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${headTags}
  </head>
  <body>
    <div id="dropinblog-content">${content}</div>
  </body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      if (onError) {
        return onError(error as Error, req, res);
      }

      console.error('DropInBlog SSR error:', error);
      res.status(500).send('Internal Server Error');
    }
  };
}
