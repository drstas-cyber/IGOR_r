import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import articles from '@/data/blog-articles.json';
import { formatArticleDate, addLazyLoading, toJsonLdScript } from '@/lib/blog';

export default function BlogPostPage() {
  const { slug } = useParams();
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    return (
      <>
        <Helmet>
          <title>Article Not Found | Temecula Valley Homes</title>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        <Navigation />
        <main className="bg-[#0D2E3A] min-h-screen flex flex-col items-center justify-center text-center px-6 py-24">
          <span className="font-sans text-[13px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold mb-4">
            Article Not Found
          </span>
          <h1 className="font-serif text-[32px] sm:text-[40px] text-white font-bold leading-[1.15] mb-4 max-w-2xl">
            We couldn't find that article
          </h1>
          <p className="font-sans text-[16px] text-gray-200 leading-[1.6] max-w-md font-light mb-8">
            It may have moved. Browse the rest of the blog instead.
          </p>
          <Link
            to="/blog/"
            className="bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] px-8 py-3 min-h-[48px] flex items-center justify-center rounded-md font-bold transition-colors"
          >
            Back to Blog
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const canonical = `https://temeculavalleyhomes.us/blog/${article.slug}/`;
  const description = article.meta_description || article.excerpt || '';
  const contentHtml = addLazyLoading(article.content_html || '');
  const jsonLd = toJsonLdScript(article.jsonLd);
  const faqJsonLd = toJsonLdScript(article.faqJsonLd);

  return (
    <>
      <Helmet>
        <title>{article.title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        {article.hero_image_url && <meta property="og:image" content={article.hero_image_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={description} />
        {article.hero_image_url && <meta name="twitter:image" content={article.hero_image_url} />}
        {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
        {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />}
      </Helmet>

      <Navigation />
      <main className="bg-[#0D2E3A] min-h-screen">
        <article className="max-w-3xl mx-auto px-4 pt-10 pb-16">
          <Link to="/blog/" className="text-[#C8920A] text-sm font-semibold hover:underline">
            ← Back to Blog
          </Link>

          <span className="text-gray-400 text-xs uppercase tracking-wide mt-6 block">
            {formatArticleDate(article.created_at)}
          </span>
          <h1 className="font-serif text-[30px] sm:text-[38px] text-white font-bold leading-tight mt-2 mb-6">
            {article.title}
          </h1>

          {article.hero_image_url && (
            <img
              src={article.hero_image_url}
              alt={article.title}
              loading="lazy"
              decoding="async"
              className="w-full rounded-xl mb-8 object-cover"
            />
          )}

          <div className="blog-prose" dangerouslySetInnerHTML={{ __html: contentHtml }} />
        </article>
      </main>
      <Footer />
    </>
  );
}
