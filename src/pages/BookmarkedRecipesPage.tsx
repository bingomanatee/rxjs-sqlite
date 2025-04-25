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
  CircularProgress,
  Alert,
  Divider,
  Chip
} from '@mui/material';
import { Bookmark as BookmarkIcon } from '@mui/icons-material';
import useRxDB from '../hooks/useRxDB';

const BookmarkedRecipesPage = () => {
  const { loading, error, getBookmarkedRecipes, removeBookmark } = useRxDB();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId] = useState('default-user'); // In a real app, this would come from auth

  useEffect(() => {
    const fetchBookmarkedRecipes = async () => {
      try {
        setIsLoading(true);
        const bookmarkedRecipes = await getBookmarkedRecipes(userId);
        setRecipes(bookmarkedRecipes);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching bookmarked recipes:', err);
        setIsLoading(false);
      }
    };

    if (!loading) {
      fetchBookmarkedRecipes();
    }
  }, [loading, getBookmarkedRecipes, userId]);

  const handleRemoveBookmark = async (recipeId: string) => {
    try {
      await removeBookmark(recipeId, userId);
      // Update the list after removing
      const bookmarkedRecipes = await getBookmarkedRecipes(userId);
      setRecipes(bookmarkedRecipes);
    } catch (err) {
      console.error('Error removing bookmark:', err);
    }
  };

  if (loading || isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading bookmarked recipes: {error.message}
      </Alert>
    );
  }

  return (
    <Box sx={{ textAlign: 'left' }}>
      <Typography variant="h4" component="h1" gutterBottom align="left">
        Your Bookmarked Recipes
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph align="left" sx={{ pr: 4 }}>
        Here are all the recipes you've saved for later.
      </Typography>

      <Divider sx={{ mb: 4 }} />

      {recipes.length === 0 ? (
        <Alert severity="info">
          You haven't bookmarked any recipes yet. Browse recipes and click the bookmark icon to save them here.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {recipes.map((recipe) => {
            const recipeData = recipe.toJSON();

            return (
              <Grid item xs={12} sm={6} md={4} key={recipeData.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardMedia
                    component="img"
                    height="200"
                    image={recipeData.thumbnail}
                    alt={recipeData.name}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h5" component="h2">
                        {recipeData.name}
                      </Typography>
                      <Chip 
                        icon={<BookmarkIcon />} 
                        label="Bookmarked" 
                        color="primary" 
                        size="small"
                        onDelete={() => handleRemoveBookmark(recipeData.id)}
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {recipeData.instructions.substring(0, 100)}
                      {recipeData.instructions.length > 100 ? '...' : ''}
                    </Typography>
                    
                    <Button
                      component={RouterLink}
                      to={`/recipes/${recipeData.id}`}
                      variant="contained"
                      color="primary"
                      fullWidth
                    >
                      View Recipe
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default BookmarkedRecipesPage;
