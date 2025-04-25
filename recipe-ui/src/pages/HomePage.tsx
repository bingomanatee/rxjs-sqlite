import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Pagination,
  Box
} from '@mui/material';
import RecipeCard from '../components/RecipeCard';
import { fetchRecipes, fetchMetadata, RecipeListItem, Metadata } from '../services/api';

const HomePage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [categories, setCategories] = useState<Record<string, Metadata>>({});
  const [cuisines, setCuisines] = useState<Record<string, Metadata>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch recipes with pagination
        const recipesData = await fetchRecipes(page);
        setRecipes(recipesData.recipes);
        setTotalPages(recipesData.pagination.totalPages);

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

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load recipes. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();
  }, [page]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo(0, 0);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Discover Delicious Recipes
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Browse our collection of recipes and find your next culinary adventure.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      ) : recipes.length === 0 ? (
        <Alert severity="info" sx={{ my: 2 }}>
          No recipes found. Try adding some recipes first.
        </Alert>
      ) : (
        <>
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
      )}
    </Container>
  );
};

export default HomePage;
