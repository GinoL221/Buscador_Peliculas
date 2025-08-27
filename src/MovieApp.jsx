import { useState, useMemo, useRef, useEffect } from "react";
import "./MovieApp.css";
import {
  fetchMovieDetails,
  fetchMovieCredits,
  fetchMovieVideos,
  fetchExternalIds,
} from "./tmdb-helpers";

export const MovieApp = () => {
  const [favorites, setFavorites] = useState(() => {
    const favs = localStorage.getItem("cineRadarFavorites");
    return favs ? JSON.parse(favs) : [];
  });
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [search, setSearch] = useState("");
  const [movieList, setMovieList] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [filters, setFilters] = useState({
    genre: "",
    year: "",
    rating: "",
    sortBy: "popularity.desc",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [homeMovies, setHomeMovies] = useState({
    trending: [],
    topRated: [],
    upcoming: [],
    popular: [],
  });
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const expansionRef = useRef(null);

  // Estado para detalles extra
  const [extraDetails, setExtraDetails] = useState({
    genres: [],
    cast: [],
    trailer: null,
    imdb: null,
  });

  // Guardar favoritos en localStorage cuando cambian
  useEffect(() => {
    localStorage.setItem("cineRadarFavorites", JSON.stringify(favorites));
  }, [favorites]);

  // Función para alternar favorito
  const toggleFavorite = (movie) => {
    setFavorites((prev) => {
      const exists = prev.some((fav) => fav.id === movie.id);
      if (exists) {
        return prev.filter((fav) => fav.id !== movie.id);
      } else {
        return [...prev, movie];
      }
    });
  };

  // Saber si una película es favorita
  const isFavorite = (movie) => favorites.some((fav) => fav.id === movie.id);
  // Cargar detalles extra al seleccionar película
  useEffect(() => {
    if (!selectedMovie) {
      setExtraDetails({ genres: [], cast: [], trailer: null, imdb: null });
      return;
    }
    (async () => {
      const [details, credits, videos, external] = await Promise.all([
        fetchMovieDetails(selectedMovie.id),
        fetchMovieCredits(selectedMovie.id),
        fetchMovieVideos(selectedMovie.id),
        fetchExternalIds(selectedMovie.id),
      ]);
      const trailer = (videos.results || []).find(
        (v) => v.type === "Trailer" && v.site === "YouTube"
      );
      setExtraDetails({
        genres: details.genres || [],
        cast: (credits.cast || []).slice(0, 6),
        trailer: trailer
          ? `https://www.youtube.com/watch?v=${trailer.key}`
          : null,
        imdb: external.imdb_id
          ? `https://www.imdb.com/title/${external.imdb_id}`
          : null,
      });
    })();
  }, [selectedMovie]);

  const urlBase = "https://api.themoviedb.org/3/search/movie";
  const urlDiscover = "https://api.themoviedb.org/3/discover/movie";
  const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

  // Cargar contenido inicial al montar el componente
  useEffect(() => {
    loadHomeContent();
  }, []);

  const loadHomeContent = async () => {
    try {
      const [trending, topRated, upcoming, popular] = await Promise.all([
        // Películas en tendencia
        fetch(
          `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}&language=es-ES`
        ),
        // Mejor calificadas
        fetch(
          `${urlDiscover}?api_key=${API_KEY}&language=es-ES&sort_by=vote_average.desc&vote_count.gte=1000&page=1`
        ),
        // Próximas a estrenar
        fetch(
          `https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}&language=es-ES&page=1`
        ),
        // Populares
        fetch(
          `${urlDiscover}?api_key=${API_KEY}&language=es-ES&sort_by=popularity.desc&page=1`
        ),
      ]);

      const [trendingData, topRatedData, upcomingData, popularData] =
        await Promise.all([
          trending.json(),
          topRated.json(),
          upcoming.json(),
          popular.json(),
        ]);

      // Filtrar películas sin imagen
      const filterWithPoster = (arr) =>
        (arr || []).filter((movie) => movie.poster_path && movie.poster_path !== "");
      setHomeMovies({
        trending: filterWithPoster(trendingData.results).slice(0, 16) || [],
        topRated: filterWithPoster(topRatedData.results).slice(0, 16) || [],
        upcoming: filterWithPoster(upcomingData.results).slice(0, 16) || [],
        popular: filterWithPoster(popularData.results).slice(0, 16) || [],
      });
    } catch (error) {
      console.error("Error cargando contenido inicial:", error);
    }
  };

  const handleInputChange = ({ target }) => {
    setSearch(target.value);
    console.log(target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (showFavorites) setShowFavorites(false);
    if (search.trim() || Object.values(filters).some((filter) => filter)) {
      setIsSearchActive(true);
      fetchMovies();
    }
  };

  // Modificar fetchMovies para manejar errores y sin resultados
  const fetchMovies = async () => {
    try {
      setErrorMsg("");
      let url;
      let results = [];

      // Si hay búsqueda por texto, usar search y filtrar por año/rango en frontend
      if (search.trim()) {
        url = `${urlBase}?query=${search}&api_key=${API_KEY}&language=es-ES`;
        const response = await fetch(url);
        const data = await response.json();
        results = data.results || [];

        // Filtrar por año/rango en frontend
        if (filters.year) {
          if (filters.year.includes(",")) {
            const [startYear, endYear] = filters.year.split(",");
            results = results.filter((movie) => {
              const y = movie.release_date
                ? parseInt(movie.release_date.slice(0, 4))
                : null;
              return y && y >= parseInt(startYear) && y <= parseInt(endYear);
            });
          } else {
            results = results.filter((movie) => {
              const y = movie.release_date
                ? movie.release_date.slice(0, 4)
                : null;
              return y === filters.year;
            });
          }
        }
        // Filtrar por género en frontend
        if (filters.genre) {
          results = results.filter(
            (movie) =>
              movie.genre_ids && movie.genre_ids.includes(Number(filters.genre))
          );
        }
      } else {
        // Si no hay búsqueda por texto, usar discover normalmente
        url = `${urlDiscover}?api_key=${API_KEY}&language=es-ES`;
        url += `&sort_by=${filters.sortBy}`;
        if (filters.year) {
          if (filters.year.includes(",")) {
            const [startYear, endYear] = filters.year.split(",");
            url += `&primary_release_date.gte=${startYear}-01-01&primary_release_date.lte=${endYear}-12-31`;
          } else {
            url += `&primary_release_year=${filters.year}`;
          }
        }
        if (filters.genre) url += `&with_genres=${filters.genre}`;
        const response = await fetch(url);
        const data = await response.json();
        results = data.results || [];
      }

      // Filtros adicionales
      if (filters.rating) {
        const ratingValue = parseFloat(filters.rating);
        // Si la opción es de regulares (5.5 o menos), filtrar por <=
        if (ratingValue <= 5.5) {
          results = results.filter(
            (movie) => movie.vote_average <= ratingValue
          );
        } else {
          results = results.filter(
            (movie) => movie.vote_average >= ratingValue
          );
        }
      }
      if (!filters.genre && !filters.year && search.trim()) {
        if (filters.sortBy === "vote_average.desc") {
          results.sort((a, b) => b.vote_average - a.vote_average);
        } else if (filters.sortBy === "release_date.desc") {
          results.sort(
            (a, b) => new Date(b.release_date) - new Date(a.release_date)
          );
        } else if (filters.sortBy === "title.asc") {
          results.sort((a, b) => a.title.localeCompare(b.title));
        }
      }

      // Filtrar películas sin imagen
      const filteredResults = results.filter(
        (movie) => movie.poster_path && movie.poster_path !== ""
      );
      setMovieList(filteredResults);
      setSelectedMovie(null);
      if (results.length === 0) {
        setErrorMsg("No se encontraron resultados para tu búsqueda.");
      }
      console.log(results);
    } catch (error) {
      setErrorMsg(
        "Ocurrió un error al buscar películas. Verifica tu conexión o intenta más tarde."
      );
      console.error("Error al buscar peliculas: ", error);
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value,
    }));
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleMovieClick = (movie) => {
    setSelectedMovie(selectedMovie?.id === movie.id ? null : movie);
  };

  const resetToHome = () => {
    setIsSearchActive(false);
    setMovieList([]);
    setSelectedMovie(null);
    setSearch("");
    setFilters({
      genre: "",
      year: "",
      rating: "",
      sortBy: "popularity.desc",
    });
  };

  // Efecto para hacer scroll a la expansión cuando se selecciona una película
  useEffect(() => {
    if (selectedMovie && expansionRef.current) {
      // Pequeño delay para que la animación de expansión comience primero
      setTimeout(() => {
        const element = expansionRef.current;
        const elementRect = element.getBoundingClientRect();
        const elementTop = elementRect.top + window.scrollY;
        const elementHeight = elementRect.height;
        const windowHeight = window.innerHeight;

        // Calcular la posición para centrar exactamente la carta en la pantalla
        const targetScrollPosition =
          elementTop - windowHeight / 2 + elementHeight / 2;

        window.scrollTo({
          top: targetScrollPosition,
          behavior: "smooth",
        });
      }, 150);
    }
  }, [selectedMovie]);

  // Función para calcular cuántas películas caben por fila (aproximado)
  const getMoviesPerRow = () => {
    // Asumiendo un ancho mínimo de 280px + gap de 30px
    const containerWidth = window.innerWidth * 0.85; // 85% del ancho
    const movieWidth = 280 + 30; // ancho mínimo + gap
    return Math.floor(containerWidth / movieWidth) || 1;
  };

  // Función para organizar las películas con la expansión en el lugar correcto
  const organizedMovies = useMemo(() => {
    if (!selectedMovie || !movieList || movieList.length === 0) {
      return movieList?.map((movie) => ({ type: "movie", data: movie })) || [];
    }

    const moviesPerRow = getMoviesPerRow();
    const selectedIndex = movieList.findIndex(
      (movie) => movie.id === selectedMovie.id
    );
    const rowOfSelected = Math.floor(selectedIndex / moviesPerRow);
    const startOfRowIndex = rowOfSelected * moviesPerRow;

    const result = [];

    // Agregar películas hasta el inicio de la fila seleccionada
    for (let i = 0; i < startOfRowIndex && i < movieList.length; i++) {
      result.push({ type: "movie", data: movieList[i] });
    }

    // Agregar la expansión ANTES de la fila seleccionada
    result.push({ type: "expansion", data: selectedMovie });

    // Agregar el resto de las películas (incluyendo la fila completa donde está la seleccionada)
    for (let i = startOfRowIndex; i < movieList.length; i++) {
      result.push({ type: "movie", data: movieList[i] });
    }

    return result;
  }, [selectedMovie, movieList]);

  // Función para hacer scroll en las listas horizontales
  const scrollHorizontal = (containerId, direction) => {
    const container = document.getElementById(containerId);
    if (container) {
      const scrollAmount = 400; // Pixels a desplazar
      const newScrollLeft =
        direction === "left"
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount;

      container.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  };

  // Reemplazar renderMovieSection para mostrar expansión arriba en búsqueda
  const renderMovieSection = (title, movies, sectionId) => (
    <>
      {/* Si la sección es la seleccionada, mostrar la expansión arriba */}
      {selectedSection === sectionId && selectedMovie && (
        <div
          className="expansion-row"
          ref={expansionRef}
          role="region"
          aria-label={`Detalles de la película ${
            selectedMovie?.title || selectedMovie?.original_title || ""
          }`}
          tabIndex={-1}
        >
          <div
            className="selected-movie-poster"
            style={{ position: "relative" }}
          >
            <img
              src={`https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}`}
              alt={selectedMovie.title}
            />
            <button
              className={`fav-btn${isFavorite(selectedMovie) ? " active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(selectedMovie);
              }}
              aria-label={
                isFavorite(selectedMovie)
                  ? "Quitar de favoritos"
                  : "Agregar a favoritos"
              }
              title={
                isFavorite(selectedMovie)
                  ? "Quitar de favoritos"
                  : "Agregar a favoritos"
              }
              style={{ zIndex: 5 }}
            >
              {isFavorite(selectedMovie) ? "★" : "☆"}
            </button>
            {extraDetails.trailer && (
              <a
                href={extraDetails.trailer}
                target="_blank"
                rel="noopener noreferrer"
                className="trailer-link"
                aria-label="Ver trailer en YouTube"
                tabIndex={0}
                style={{
                  display: "block",
                  marginTop: 12,
                  textAlign: "center",
                  color: "#e879f9",
                  fontWeight: 600,
                }}
              >
                ▶️ Ver Trailer
              </a>
            )}
          </div>
          <div className="selected-movie-details">
            <button
              className="close-btn"
              style={{ position: "absolute", top: 10, right: 10, zIndex: 2 }}
              onClick={() => setSelectedMovie(null)}
              aria-label="Cerrar detalles de la película"
              tabIndex={0}
            >
              ✖
            </button>
            <h3 tabIndex={0}>{selectedMovie.title}</h3>
            <p>
              <strong>Fecha de lanzamiento:</strong>{" "}
              {selectedMovie.release_date}
            </p>
            <p>
              <strong>Puntuación:</strong> {selectedMovie.vote_average}/10
            </p>
            <p>
              <strong>Géneros:</strong>{" "}
              {extraDetails.genres.map((g) => g.name).join(", ") || "-"}
            </p>
            <p>
              <strong>Elenco:</strong>{" "}
              {extraDetails.cast.map((a) => a.name).join(", ") || "-"}
            </p>
            <p>
              <strong>Descripción:</strong>{" "}
              {selectedMovie.overview || "Sin descripción disponible."}
            </p>
            {extraDetails.imdb && (
              <a
                href={extraDetails.imdb}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ver en IMDB"
                tabIndex={0}
                style={{
                  color: "#f5c518",
                  fontWeight: 700,
                  textDecoration: "underline",
                  marginRight: 12,
                }}
              >
                Ver en IMDB
              </a>
            )}
          </div>
        </div>
      )}
      <div className="movie-section" key={sectionId}>
        <h2 className="section-title">{title}</h2>
        <div className="movie-list-container">
          <button
            className="scroll-btn scroll-btn-left"
            onClick={() => scrollHorizontal(`list-${sectionId}`, "left")}
            aria-label="Desplazar izquierda"
          >
            ←
          </button>
          <div className="movie-horizontal-list" id={`list-${sectionId}`}>
            {movies.map((movie) => (
              <div
                key={movie.id}
                className="movie-card-small"
                onClick={() => {
                  setSelectedMovie(movie);
                  setSelectedSection(sectionId);
                }}
                role="button"
                aria-label={`Ver detalles de ${movie.title}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setSelectedMovie(movie);
                    setSelectedSection(sectionId);
                  }
                }}
                style={{ position: "relative" }}
              >
                <img
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={movie.title}
                  onError={(e) => {
                    e.target.src =
                      "https://via.placeholder.com/300x450/1a0f23/e879f9?text=Sin+Imagen";
                  }}
                />
                <button
                  className={`fav-btn${isFavorite(movie) ? " active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(movie);
                  }}
                  aria-label={
                    isFavorite(movie)
                      ? "Quitar de favoritos"
                      : "Agregar a favoritos"
                  }
                  title={
                    isFavorite(movie)
                      ? "Quitar de favoritos"
                      : "Agregar a favoritos"
                  }
                  style={{ zIndex: 5 }}
                >
                  {isFavorite(movie) ? "★" : "☆"}
                </button>
                <div className="movie-title movie-title-small">
                  <h3>{movie.title}</h3>
                  <p className="movie-rating">
                    ⭐ {movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            className="scroll-btn scroll-btn-right"
            onClick={() => scrollHorizontal(`list-${sectionId}`, "right")}
            aria-label="Desplazar derecha"
          >
            →
          </button>
        </div>
      </div>
    </>
  );

  // SEO: título dinámico y meta tags
  useEffect(() => {
    let title = "CineRadar - Buscador de Películas";
    if (selectedMovie) {
      title = `${
        selectedMovie.title || selectedMovie.original_title
      } | CineRadar`;
    } else if (isSearchActive && search) {
      title = `Resultados para "${search}" | CineRadar`;
    }
    document.title = title;
    // Meta description
    let desc =
      "Explora y descubre películas populares, tendencias, estrenos y más con CineRadar. Filtros avanzados, trailers, elenco y enlaces a IMDB.";
    if (selectedMovie) {
      desc = selectedMovie.overview || desc;
    }
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = desc;
    // Meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement("meta");
      metaKeywords.name = "keywords";
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.content =
      "películas, buscador, cine, trailers, elenco, IMDB, géneros, estrenos, populares, tendencias, CineRadar";
  }, [selectedMovie, isSearchActive, search]);

  return (
    <div className="container">
      <div className="favorites-bar">
        <button
          className="favorites-toggle-btn"
          onClick={() => {
            setShowFavorites((v) => {
              const next = !v;
              if (next) {
                setIsSearchActive(false);
                setSearch("");
                setMovieList([]);
                setSelectedMovie(null);
                setSelectedSection(null);
              }
              return next;
            });
          }}
        >
          {showFavorites ? "Ver Todas" : "⭐ Favoritos"}
        </button>
      </div>
      <h1 className="title">📽️CineRadar📡</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Escribí una pelicula"
          value={search}
          onChange={handleInputChange}
        />

        <button className="search-button" type="submit">
          Buscar
        </button>
        <button
          className="filter-toggle-btn"
          type="button"
          onClick={toggleFilters}
        >
          {showFilters ? "Ocultar Filtros" : "Mostrar Filtros"}
        </button>
      </form>

      {/* Botón para volver al inicio */}
      {isSearchActive && (
        <div className="back-to-home">
          <button className="back-home-btn" onClick={resetToHome}>
            🏠 Volver al Inicio
          </button>
        </div>
      )}

      {showFilters && (
        <div className="filters-container">
          <div className="filter-group">
            <label>Año:</label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange("year", e.target.value)}
            >
              <option value="">Todos los años</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
              <option value="2020">2020</option>
              <option value="2019">2019</option>
              <option value="2018">2018</option>
              <option value="2017">2017</option>
              <option value="2016">2016</option>
              <option value="2015">2015</option>
              <option value="2014">2014</option>
              <option value="2013">2013</option>
              <option value="2012">2012</option>
              <option value="2011">2011</option>
              <option value="2010">2010</option>
              <optgroup label="Décadas anteriores">
                <option value="2000,2009">2000-2009</option>
                <option value="1990,1999">1990-1999</option>
                <option value="1980,1989">1980-1989</option>
                <option value="1970,1979">1970-1979</option>
                <option value="1960,1969">1960-1969</option>
                <option value="1950,1959">1950-1959</option>
                <option value="1900,1949">1900-1949</option>
              </optgroup>
            </select>
          </div>

          <div className="filter-group">
            <label>Género:</label>
            <select
              value={filters.genre}
              onChange={(e) => handleFilterChange("genre", e.target.value)}
            >
              <option value="">Todos los géneros</option>
              <option value="28">Acción</option>
              <option value="12">Aventura</option>
              <option value="16">Animación</option>
              <option value="35">Comedia</option>
              <option value="80">Crimen</option>
              <option value="99">Documental</option>
              <option value="18">Drama</option>
              <option value="10751">Familiar</option>
              <option value="14">Fantasía</option>
              <option value="36">Historia</option>
              <option value="27">Terror</option>
              <option value="10402">Música</option>
              <option value="9648">Misterio</option>
              <option value="10749">Romance</option>
              <option value="878">Ciencia ficción</option>
              <option value="10770">Película de TV</option>
              <option value="53">Suspense</option>
              <option value="10752">Guerra</option>
              <option value="37">Western</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Calificación mínima:</label>
            <select
              value={filters.rating}
              onChange={(e) => handleFilterChange("rating", e.target.value)}
            >
              <option value="">Cualquier calificación</option>
              <optgroup label="Excelentes">
                <option value="9">9.0+ ⭐⭐⭐ Obras maestras</option>
                <option value="8.5">8.5+ ⭐⭐⭐ Excepcionales</option>
                <option value="8">8.0+ ⭐⭐ Muy buenas</option>
              </optgroup>
              <optgroup label="Buenas">
                <option value="7.5">7.5+ ⭐⭐ Recomendadas</option>
                <option value="7">7.0+ ⭐ Buenas</option>
                <option value="6.5">6.5+ ⭐ Decentes</option>
                <option value="6">6.0+ Aceptables</option>
              </optgroup>
              <optgroup label="Regulares">
                <option value="5.5">5.5- Mediocres</option>
                <option value="5">5.0- Regulares</option>
                <option value="4">4.0- Malas</option>
                <option value="3">3.0- Muy malas</option>
              </optgroup>
            </select>
          </div>

          <div className="filter-group">
            <label>Ordenar por:</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
            >
              <option value="popularity.desc">Popularidad</option>
              <option value="vote_average.desc">Mejor calificación</option>
              <option value="release_date.desc">Más recientes</option>
              <option value="title.asc">Título (A-Z)</option>
            </select>
          </div>

          <div className="filter-actions">
            <button className="apply-filters-btn" onClick={fetchMovies}>
              Aplicar Filtros
            </button>
            <button
              className="clear-filters-btn"
              onClick={() => {
                setFilters({
                  genre: "",
                  year: "",
                  rating: "",
                  sortBy: "popularity.desc",
                });
                // Esperar un momento para que se actualice el estado y luego buscar
                setTimeout(() => {
                  if (search.trim()) {
                    fetchMovies();
                  } else {
                    setMovieList([]);
                  }
                }, 100);
              }}
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Sección de favoritos */}
      {showFavorites ? (
        <div className="favorites-section">
          <h2 className="section-title">⭐ Tus Favoritos</h2>
          {favorites.length === 0 ? (
            <p style={{ textAlign: "center", color: "#aaa" }}>
              No tienes películas favoritas aún.
            </p>
          ) : (
            <div className="movie-list">
              {favorites.map((movie) => (
                <div
                  key={movie.id}
                  className="movie-card"
                  onClick={() => handleMovieClick(movie)}
                  style={{ position: "relative" }}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title || movie.original_title}
                  />
                  <button
                    className={`fav-btn${isFavorite(movie) ? " active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(movie);
                    }}
                    aria-label={
                      isFavorite(movie)
                        ? "Quitar de favoritos"
                        : "Agregar a favoritos"
                    }
                    title={
                      isFavorite(movie)
                        ? "Quitar de favoritos"
                        : "Agregar a favoritos"
                    }
                  >
                    {isFavorite(movie) ? "★" : "☆"}
                  </button>
                  <div className="movie-title">
                    <h3>{movie.title || movie.original_title}</h3>
                    <p className="movie-rating">
                      ⭐{" "}
                      {movie.vote_average
                        ? movie.vote_average.toFixed(1)
                        : "N/A"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Expansión de detalles SOLO para favoritos */}
          {selectedMovie &&
            favorites.some((f) => f.id === selectedMovie.id) && (
              <div
                className="expansion-row"
                ref={expansionRef}
                role="region"
                aria-label={`Detalles de la película ${
                  selectedMovie?.title || selectedMovie?.original_title || ""
                }`}
                tabIndex={-1}
              >
                <div
                  className="selected-movie-poster"
                  style={{ position: "relative" }}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}`}
                    alt={selectedMovie.title}
                  />
                  <button
                    className={`fav-btn${
                      isFavorite(selectedMovie) ? " active" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(selectedMovie);
                    }}
                    aria-label={
                      isFavorite(selectedMovie)
                        ? "Quitar de favoritos"
                        : "Agregar a favoritos"
                    }
                    title={
                      isFavorite(selectedMovie)
                        ? "Quitar de favoritos"
                        : "Agregar a favoritos"
                    }
                    style={{ zIndex: 5 }}
                  >
                    {isFavorite(selectedMovie) ? "★" : "☆"}
                  </button>
                  {extraDetails.trailer && (
                    <a
                      href={extraDetails.trailer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="trailer-link"
                      aria-label="Ver trailer en YouTube"
                      tabIndex={0}
                      style={{
                        display: "block",
                        marginTop: 12,
                        textAlign: "center",
                        color: "#e879f9",
                        fontWeight: 600,
                      }}
                    >
                      ▶️ Ver Trailer
                    </a>
                  )}
                </div>
                <div className="selected-movie-details">
                  <button
                    className="close-btn"
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      zIndex: 2,
                    }}
                    onClick={() => setSelectedMovie(null)}
                    aria-label="Cerrar detalles de la película"
                    tabIndex={0}
                  >
                    ✖
                  </button>
                  <h3 tabIndex={0}>{selectedMovie.title}</h3>
                  <p>
                    <strong>Fecha de lanzamiento:</strong>{" "}
                    {selectedMovie.release_date}
                  </p>
                  <p>
                    <strong>Puntuación:</strong> {selectedMovie.vote_average}/10
                  </p>
                  <p>
                    <strong>Géneros:</strong>{" "}
                    {extraDetails.genres.map((g) => g.name).join(", ") || "-"}
                  </p>
                  <p>
                    <strong>Elenco:</strong>{" "}
                    {extraDetails.cast.map((a) => a.name).join(", ") || "-"}
                  </p>
                  <p>
                    <strong>Descripción:</strong>{" "}
                    {selectedMovie.overview || "Sin descripción disponible."}
                  </p>
                  {extraDetails.imdb && (
                    <a
                      href={extraDetails.imdb}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Ver en IMDB"
                      tabIndex={0}
                      style={{
                        color: "#f5c518",
                        fontWeight: 700,
                        textDecoration: "underline",
                        marginRight: 12,
                      }}
                    >
                      Ver en IMDB
                    </a>
                  )}
                </div>
              </div>
            )}
        </div>
      ) : (
        // Secciones de inicio
        !isSearchActive && (
          <div className="home-sections">
            {renderMovieSection(
              "🔥 Tendencias de la Semana",
              homeMovies.trending,
              "trending"
            )}
            {renderMovieSection(
              "⭐ Mejor Calificadas",
              homeMovies.topRated,
              "topRated"
            )}
            {renderMovieSection(
              "🎬 Próximas a Estrenar",
              homeMovies.upcoming,
              "upcoming"
            )}
            {renderMovieSection("🌟 Populares", homeMovies.popular, "popular")}
          </div>
        )
      )}

      {/* Resultados de búsqueda */}
      {isSearchActive && movieList && movieList.length > 0 && (
        <>
          <div className="movie-list">
            {organizedMovies.map((item, index) =>
              item.type === "movie" ? (
                <div
                  key={item.data.id}
                  className={`movie-card ${
                    selectedMovie?.id === item.data.id ? "active" : ""
                  }`}
                  onClick={() => handleMovieClick(item.data)}
                  style={{ position: "relative" }}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w500${item.data.poster_path}`}
                    alt={item.data.title || item.data.original_title}
                  />
                  <div className="movie-title">
                    <h3>{item.data.title || item.data.original_title}</h3>
                    <p className="movie-rating">
                      ⭐{" "}
                      {item.data.vote_average
                        ? item.data.vote_average.toFixed(1)
                        : "N/A"}
                    </p>
                  </div>
                  <button
                    className={`fav-btn${
                      isFavorite(item.data) ? " active" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(item.data);
                    }}
                    aria-label={
                      isFavorite(item.data)
                        ? "Quitar de favoritos"
                        : "Agregar a favoritos"
                    }
                    title={
                      isFavorite(item.data)
                        ? "Quitar de favoritos"
                        : "Agregar a favoritos"
                    }
                  >
                    {isFavorite(item.data) ? "★" : "☆"}
                  </button>
                </div>
              ) : (
                <div
                  key={`expansion-${index}`}
                  className="expansion-row"
                  ref={expansionRef}
                  role="region"
                  aria-label={`Detalles de la película ${
                    item.data.title || item.data.original_title || ""
                  }`}
                  tabIndex={-1}
                >
                  <div className="selected-movie-poster">
                    <img
                      src={`https://image.tmdb.org/t/p/w500${item.data.poster_path}`}
                      alt={item.data.title}
                    />
                    {extraDetails.trailer && (
                      <a
                        href={extraDetails.trailer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="trailer-link"
                        aria-label="Ver trailer en YouTube"
                        tabIndex={0}
                        style={{
                          display: "block",
                          marginTop: 12,
                          textAlign: "center",
                          color: "#e879f9",
                          fontWeight: 600,
                        }}
                      >
                        ▶️ Ver Trailer
                      </a>
                    )}
                  </div>
                  <div className="selected-movie-details">
                    <button
                      className="close-btn"
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        zIndex: 2,
                      }}
                      onClick={() => setSelectedMovie(null)}
                      aria-label="Cerrar detalles de la película"
                      tabIndex={0}
                    >
                      ✖
                    </button>
                    <h3 tabIndex={0}>
                      {item.data.title || item.data.original_title}
                    </h3>
                    <p>
                      <strong>Fecha de lanzamiento:</strong>{" "}
                      {item.data.release_date}
                    </p>
                    <p>
                      <strong>Puntuación:</strong> {item.data.vote_average}/10
                    </p>
                    <p>
                      <strong>Géneros:</strong>{" "}
                      {extraDetails.genres.map((g) => g.name).join(", ") || "-"}
                    </p>
                    <p>
                      <strong>Elenco:</strong>{" "}
                      {extraDetails.cast.map((a) => a.name).join(", ") || "-"}
                    </p>
                    <p>
                      <strong>Descripción:</strong>{" "}
                      {item.data.overview || "Sin descripción disponible."}
                    </p>
                    {extraDetails.imdb && (
                      <a
                        href={extraDetails.imdb}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Ver en IMDB"
                        tabIndex={0}
                        style={{
                          color: "#f5c518",
                          fontWeight: 700,
                          textDecoration: "underline",
                          marginRight: 12,
                        }}
                      >
                        Ver en IMDB
                      </a>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* Mostrar mensaje de error o sin resultados */}
      {isSearchActive && errorMsg && (
        <div
          style={{
            color: "#ef4444",
            textAlign: "center",
            margin: "30px 0",
            fontWeight: 600,
            fontSize: 18,
          }}
          role="alert"
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
};
