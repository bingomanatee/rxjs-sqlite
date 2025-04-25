import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import useRxDB from '../hooks/useRxDB';

const HomePage = () => {
  const { loading, error, getRecipes, getMetadataByType } = useRxDB();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, any>>({});
  const [cuisines, setCuisines] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch recipes
        const recipeList = await getRecipes();
        setRecipes(recipeList);

        // Fetch categories and cuisines
        const categoryList = await getMetadataByType('category');
        const categoryMap: Record<string, any> = {};
        categoryList.forEach((category: any) => {
          categoryMap[category.get('id')] = category.toJSON();
        });
        setCategories(categoryMap);

        const cuisineList = await getMetadataByType('cuisine');
        const cuisineMap: Record<string, any> = {};
        cuisineList.forEach((cuisine: any) => {
          cuisineMap[cuisine.get('id')] = cuisine.toJSON();
        });
        setCuisines(cuisineMap);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    if (!loading) {
      fetchData();
    }
  }, [loading, getRecipes, getMetadataByType]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading recipes: {error.message}
      </Alert>
    );
  }

  return (
    <Box sx={{ textAlign: 'left' }}>
      <Typography variant="h4" component="h1" gutterBottom align="left">
        Discover Delicious Recipes
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph align="left" sx={{ pr: 4 }}>
        Browse our collection of recipes and find your next culinary adventure.
      </Typography>

      {recipes.length === 0 ? (
        <Alert severity="info">No recipes found. Try syncing data from the server.</Alert>
      ) : (
        <Box sx={{ mt: 2 }}>
          {recipes.slice(0, 5).map((recipe) => {
            const recipeData = recipe.toJSON();

            return (
              <Box
                key={recipeData.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 2,
                  p: 1,
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
                component={RouterLink}
                to={`/recipes/${recipeData.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Box
                  sx={{
                    width: '1in',
                    height: '1in',
                    borderRadius: 1,
                    overflow: 'hidden',
                    flexShrink: 0,
                    mr: 2
                  }}
                >
                  <img
                    src={recipeData.thumbnail}
                    alt={recipeData.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </Box>
                <Box sx={{ pr: 3 }}>
                  <Typography variant="h6" component="h2" align="left">
                    {recipeData.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} align="left">
                    {recipeData.description ||
                      (recipeData.instructions.substring(0, 60) +
                      (recipeData.instructions.length > 60 ? '...' : ''))}
                  </Typography>
                  {(recipeData.category || recipeData.cuisine) && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }} align="left">
                      {recipeData.category && recipeData.cuisine
                        ? `${recipeData.category.displayName} • ${recipeData.cuisine.displayName}`
                        : recipeData.category
                          ? recipeData.category.displayName
                          : recipeData.cuisine
                            ? recipeData.cuisine.displayName
                            : ''}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              to="/recipes"
            >
              View All Recipes
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default HomePage;
