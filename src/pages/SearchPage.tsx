import React, { useState, useEffect } from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import useRxDB from '../hooks/useRxDB';

const SearchPage = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialQuery = queryParams.get('q') || '';

  const { loading, error, searchRecipes, getMetadataByType } = useRxDB();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, any>>({});
  const [cuisines, setCuisines] = useState<Record<string, any>>({});
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
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
        console.error('Error fetching metadata:', err);
      }
    };

    if (!loading) {
      fetchMetadata();

      // If there's an initial query, perform search
      if (initialQuery) {
        handleSearch();
      }
    }
  }, [loading, getMetadataByType, initialQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const results = await searchRecipes(searchQuery);
      setSearchResults(results);
      setSearched(true);
      setSearching(false);
    } catch (err) {
      console.error('Error searching recipes:', err);
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

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
        Error loading search: {error.message}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
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
          disabled={searching || !searchQuery.trim()}
        >
          {searching ? <CircularProgress size={24} /> : 'Search'}
        </Button>
      </Box>

      {searching ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : searched ? (
        searchResults.length === 0 ? (
          <Alert severity="info">
            No recipes found matching "{searchQuery}". Try a different search term.
          </Alert>
        ) : (
          <>
            <Typography variant="h6" gutterBottom>
              Found {searchResults.length} recipes matching "{searchQuery}"
            </Typography>

            <Grid container spacing={3} sx={{ mt: 2 }}>
              {searchResults.map((recipe) => {
                const recipeData = recipe.toJSON();
                const category = categories[recipeData.categoryId]?.displayName || '';
                const cuisine = cuisines[recipeData.cuisineId]?.displayName || '';

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
                        <Typography variant="h5" component="h2" gutterBottom>
                          {recipeData.name}
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                          {category && (
                            <Chip
                              label={category}
                              size="small"
                              sx={{ mr: 1, mb: 1 }}
                              color="primary"
                              variant="outlined"
                            />
                          )}
                          {cuisine && (
                            <Chip
                              label={cuisine}
                              size="small"
                              sx={{ mr: 1, mb: 1 }}
                              color="secondary"
                              variant="outlined"
                            />
                          )}
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
          </>
        )
      ) : (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Enter a search term to find recipes by name, ingredients, or instructions.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SearchPage;
