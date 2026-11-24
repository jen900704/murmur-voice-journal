"""Optional LDA topics, estimated only from the person's own messages.

DLATK estimates topics with Mallet or PyMallet. PyMallet does not install on Python 3.12 or
later, so here the topics are estimated with scikit-learn's LatentDirichletAllocation and
then handed to the engine as a weighted lexicon (term, topic, P(topic | word)), which is the
form DLATK itself uses to score topics. Nothing is downloaded and no pretrained topics are used.
"""
from collections import Counter

from .textprep import tokenize


def available():
    try:
        import sklearn  # noqa: F401
        return True
    except Exception:
        return False


def version():
    try:
        import sklearn
        return sklearn.__version__
    except Exception:
        return None


def estimate(texts, num_topics=5, top_words=15, min_doc_freq=3, seed=0, num_stopwords=50):
    """-> (lexicon rows [(term, 'TOPIC_k', weight)], summary [(topic, [(word, weight), ...])]).
    Words are kept when they contain a letter, are not among the num_stopwords most frequent
    words of this text collection, and occur in at least min_doc_freq messages."""
    import numpy as np
    from sklearn.decomposition import LatentDirichletAllocation

    docs = [[t for t in tokenize(x) if any(c.isalpha() for c in t) and not t.startswith("<")] for x in texts]
    total = Counter(t for d in docs for t in d)
    stop = {w for w, _ in sorted(total.items(), key=lambda kv: (-kv[1], kv[0]))[:num_stopwords]}
    df = Counter(t for d in docs for t in set(d))
    vocab = sorted(w for w in total if w not in stop and df[w] >= min_doc_freq)
    if len(vocab) < num_topics * 3:
        raise ValueError("only %d words are left after removing frequent and rare words" % len(vocab))
    index = {w: i for i, w in enumerate(vocab)}
    X = np.zeros((len(docs), len(vocab)))
    for i, d in enumerate(docs):
        for t in d:
            if t in index:
                X[i, index[t]] += 1
    X = X[X.sum(axis=1) > 0]
    lda = LatentDirichletAllocation(n_components=num_topics, random_state=seed, max_iter=200, learning_method="batch")
    lda.fit(X)
    word_topic = lda.components_ / lda.components_.sum(axis=0, keepdims=True)   # P(topic | word)
    rows, summary = [], []
    for k in range(num_topics):
        top = sorted(range(len(vocab)), key=lambda j: (-lda.components_[k, j], vocab[j]))[:top_words]
        name = "TOPIC_%d" % (k + 1)
        words = [(vocab[j], float(word_topic[k, j])) for j in top]
        rows.extend((w, name, wt) for w, wt in words)
        summary.append((name, words))
    return rows, summary
