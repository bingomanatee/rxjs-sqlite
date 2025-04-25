import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Pagination,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import RecipeCard from '../components/RecipeCard';
import { searchRecipes, fetchMetadata, RecipeListItem, Metadata } from '../services/api';

const SearchPage = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialQuery = queryParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [categories, setCategories] = useState<Record<string, Metadata>>({});
  const [cuisines, setCuisines] = useState<Record<string, Metadata>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchMetadataData = async () => {
      try {
        // Fetch categories and cuisines
        const metadataList = await fetchMetadata();

        // Create maps for categories and cuisines
        const categoryMap: Record<string, Metadata> = {};
        const cuisineMap: Record<string, Metadata> = {};

        metadataList.forEach(item => {
          if (item.type === 'category') {
            categoryMap[item.id] = item;
          } else if (item.type === 'cuisine') {
            cuisineMap[item.id] = item;
          }
        });

        setCategories(categoryMap);
        setCuisines(cuisineMap);
      } catch (err) {
        console.error('Error fetching metadata:', err);
      }
    };

    fetchMetadataData();

    // If there's an initial query, perform search
    if (initialQuery) {
      handleSearch();
    }
  }, [initialQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const data = await searchRecipes(searchQuery, page);
      setRecipes(data.recipes);
      setTotalPages(data.pagination.totalPages);
      setSearched(true);
      setLoading(false);
    } catch (err) {
      console.error('Error searching recipes:', err);
      setError('Failed to search recipes. Please try again later.');
      setLoading(false);
    }
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo(0, 0);
    handleSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Search Recipes
      </Typography>

      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
        <TextField
          fullWidth
          label="Search for recipes"
          variant="outlined"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mr: 2 }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSearch}
          disabled={loading || !searchQuery.trim()}
          sx={{ height: 56, px: 4 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Search'}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      ) : searched ? (
        recipes.length === 0 ? (
          <Alert severity="info" sx={{ my: 2 }}>
            No recipes found matching "{searchQuery}". Try a different search term.
          </Alert>
        ) : (
          <>
            <Typography variant="h6" gutterBottom>
              Found {recipes.length} recipes matching "{searchQuery}"
            </Typography>

            <Grid container spacing={3} sx={{ mt: 2 }}>
              {recipes.map((recipe) => (
                <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                  <RecipeCard
                    recipe={recipe}
                    categoryName={categories[recipe.categoryId]?.displayName}
                    cuisineName={cuisines[recipe.cuisineId]?.displayName}
                  />
                </Grid>
              ))}
            </Grid>

            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                />
              </Box>
            )}
          </>
        )
      ) : (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Enter a search term to find recipes by name, ingredients, or instructions.
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default SearchPage;
