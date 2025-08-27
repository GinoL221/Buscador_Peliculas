// Funciones auxiliares para obtener trailers, elenco, géneros y links externos de TMDB
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";

export async function fetchMovieDetails(movieId, language = "es-ES") {
  const res = await fetch(`${BASE_URL}/movie/${movieId}?api_key=${API_KEY}&language=${language}`);
  return res.json();
}

export async function fetchMovieCredits(movieId, language = "es-ES") {
  const res = await fetch(`${BASE_URL}/movie/${movieId}/credits?api_key=${API_KEY}&language=${language}`);
  return res.json();
}

export async function fetchMovieVideos(movieId, language = "es-ES") {
  const res = await fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}&language=${language}`);
  return res.json();
}

export async function fetchExternalIds(movieId) {
  const res = await fetch(`${BASE_URL}/movie/${movieId}/external_ids?api_key=${API_KEY}`);
  return res.json();
}
