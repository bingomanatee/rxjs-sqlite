import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardMedia,
  Chip,
  Button,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Popover,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Restaurant as RestaurantIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Info as InfoIcon,
  FindInPage as FindInPageIcon,
} from '@mui/icons-material';
import useRxDB from '../hooks/useRxDB';
import { syncRecipeDetail } from '../services/sync';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`recipe-tabpanel-${index}`}
      aria-labelledby={`recipe-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3, textAlign: 'left' }}>{children}</Box>}
    </div>
  );
}

const RecipeDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    loading,
    error,
    getRecipeById,
    getRecipeSteps,
    getRecipeIngredients,
    isRecipeBookmarked,
    addBookmark,
    removeBookmark,
    searchRecipes
  } = useRxDB();
  const [recipe, setRecipe] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [detailLoading, setDetailLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null);
  const [relatedRecipesCount, setRelatedRecipesCount] = useState(0);

  useEffect(() => {
    const fetchRecipeDetail = async () => {
      if (!id) return;

      try {
        setDetailLoading(true);

        // Sync recipe detail from server
        await syncRecipeDetail(id);

        // Get recipe from local database
        const recipeDoc = await getRecipeById(id);
        if (!recipeDoc) {
          throw new Error('Recipe not found');
        }

        setRecipe(recipeDoc);

        // Get steps
        const stepsData = await getRecipeSteps(id);
        setSteps(stepsData);

        // Get ingredients
        const ingredientsData = await getRecipeIngredients(id);
        setIngredients(ingredientsData);

        setDetailLoading(false);
      } catch (err) {
        console.error('Error fetching recipe detail:', err);
        setDetailLoading(false);
      }
    };

    if (!loading) {
      fetchRecipeDetail();
    }
  }, [id, loading, getRecipeById, getRecipeSteps, getRecipeIngredients]);

  // Check if recipe is bookmarked
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (!id || loading) return;

      try {
        const isBookmarked = await isRecipeBookmarked(id);
        setBookmarked(isBookmarked);
      } catch (err) {
        console.error('Error checking bookmark status:', err);
      }
    };

    checkBookmarkStatus();
  }, [id, loading, isRecipeBookmarked]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleToggleBookmark = async () => {
    if (!id) return;

    try {
      setBookmarkLoading(true);

      if (bookmarked) {
        await removeBookmark(id);
        setBookmarked(false);
      } else {
        await addBookmark(id);
        setBookmarked(true);
      }

      setBookmarkLoading(false);
    } catch (err) {
      console.error('Error toggling bookmark:', err);
      setBookmarkLoading(false);
    }
  };

  const handleIngredientClick = async (event: React.MouseEvent<HTMLElement>, ingredient: any) => {
    setAnchorEl(event.currentTarget);
    setSelectedIngredient(ingredient);

    // Count recipes that contain this ingredient
    if (ingredient && ingredient.name) {
      try {
        const recipes = await searchRecipes(ingredient.name);
        // Filter out current recipe
        const otherRecipes = recipes.filter((r: any) => r.get('id') !== id);
        setRelatedRecipesCount(otherRecipes.length);
      } catch (err) {
        console.error('Error searching for related recipes:', err);
        setRelatedRecipesCount(0);
      }
    }
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
    setSelectedIngredient(null);
  };

  const handleFindRecipes = () => {
    if (selectedIngredient && selectedIngredient.name) {
      navigate(`/search?q=${encodeURIComponent(selectedIngredient.name)}`);
      handlePopoverClose();
    }
  };

  if (loading || detailLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading recipe: {error.message}
      </Alert>
    );
  }

  if (!recipe) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Recipe not found
      </Alert>
    );
  }

  const recipeData = recipe.toJSON();

  // Debug: Log the recipe data to check if category and cuisine are included
  console.log('Recipe data:', recipeData);
  console.log('Category and cuisine:', recipeData.category, recipeData.cuisine);

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          variant="text"
        >
          Back
        </Button>
      </Box>

      <Card sx={{ mb: 4 }}>
        <CardMedia
          component="img"
          height="300"
          image={recipeData.thumbnail}
          alt={recipeData.name}
        />
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {recipeData.name}
            </Typography>
            <IconButton
              onClick={handleToggleBookmark}
              color={bookmarked ? "primary" : "default"}
              disabled={bookmarkLoading}
              sx={{ ml: 2 }}
            >
              {bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
          </Box>

          {/* Category and Cuisine as text */}
          {(recipeData.category || recipeData.cuisine) && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {recipeData.category && recipeData.cuisine
                ? `${recipeData.category.displayName} • ${recipeData.cuisine.displayName}`
                : recipeData.category
                  ? recipeData.category.displayName
                  : recipeData.cuisine
                    ? recipeData.cuisine.displayName
                    : ''}
            </Typography>
          )}

          {/* Recipe Description */}
          <Typography variant="body1" paragraph sx={{ mb: 3 }}>
            {recipeData.description ||
              (recipeData.instructions.substring(0, 150) +
              (recipeData.instructions.length > 150 ? '...' : ''))}
          </Typography>


        </Box>
      </Card>

      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="recipe tabs"
            centered
          >
            <Tab
              icon={<RestaurantIcon />}
              iconPosition="start"
              label="Ingredients"
              id="recipe-tab-0"
              aria-controls="recipe-tabpanel-0"
            />
            <Tab
              label="Steps"
              id="recipe-tab-1"
              aria-controls="recipe-tabpanel-1"
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <List>
            {ingredients.length === 0 ? (
              <Alert severity="info">No ingredients found for this recipe.</Alert>
            ) : (
              ingredients.map((item, index) => {
                const ingredientData = item.ingredient;
                const measure = item.getFormattedMeasure ?
                  item.getFormattedMeasure() :
                  (item.quantity ? `${item.quantity} ${item.unit || ''}` : item.originalMeasure);

                return (
                  <Box key={item.id}>
                    <ListItem sx={{ pr: 8 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography sx={{ flexGrow: 1 }}>
                              <strong>{measure}</strong> {ingredientData.name}
                              {item.additionalInfo && ` (${item.additionalInfo})`}
                            </Typography>
                            <IconButton
                              color="primary"
                              onClick={(e) => handleIngredientClick(e, ingredientData)}
                              size="small"
                              sx={{
                                ml: 1,
                                border: '2px solid',
                                borderColor: '#1976d2',
                                bgcolor: '#e3f2fd',
                                color: '#1976d2',
                                '&:hover': {
                                  bgcolor: '#1976d2',
                                  color: 'white'
                                }
                              }}
                            >
                              <InfoIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                        secondary={ingredientData.description ? ingredientData.description.substring(0, 60) + (ingredientData.description.length > 60 ? '...' : '') : null}
                      />
                    </ListItem>
                    {index < ingredients.length - 1 && <Divider />}
                  </Box>
                );
              })
            )}
          </List>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {steps.length === 0 ? (
            <Alert severity="info">No steps found for this recipe.</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {steps
                .sort((a: any, b: any) => a.get('stepNumber') - b.get('stepNumber'))
                .map((step: any) => {
                  const stepData = step.toJSON();

                  return (
                    <Paper
                      key={stepData.id}
                      elevation={1}
                      sx={{
                        p: 3,
                        display: 'flex',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2,
                          flexShrink: 0,
                        }}
                      >
                        <Typography variant="h6">{stepData.stepNumber}</Typography>
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" align="left" sx={{ textAlign: 'left' }}>
                          {stepData.instruction}
                        </Typography>
                      </Box>
                    </Paper>
                  );
                })}
            </Box>
          )}
        </TabPanel>
      </Box>

      {/* Ingredient Popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          elevation: 3,
          sx: { borderRadius: 2 }
        }}
      >
        {selectedIngredient && (
          <Box sx={{ p: 3, maxWidth: 350 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ flexGrow: 1, color: 'primary.main' }}>
                {selectedIngredient.name}
              </Typography>
              {relatedRecipesCount > 0 && (
                <Badge
                  badgeContent={relatedRecipesCount}
                  color="primary"
                  sx={{ mr: 1 }}
                >
                  <FindInPageIcon color="action" />
                </Badge>
              )}
            </Box>

            {selectedIngredient.description && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body2">
                  {selectedIngredient.description}
                </Typography>
              </Paper>
            )}

            {selectedIngredient.nutritionalInfo && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Nutritional Info
                </Typography>
                <Typography variant="body2">
                  {selectedIngredient.nutritionalInfo}
                </Typography>
              </Paper>
            )}

            {selectedIngredient.substitutes && selectedIngredient.substitutes.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Substitutes
                </Typography>
                <Typography variant="body2">
                  {selectedIngredient.substitutes.join(', ')}
                </Typography>
              </Paper>
            )}

            {relatedRecipesCount > 0 && (
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="medium"
                  startIcon={<FindInPageIcon />}
                  onClick={handleFindRecipes}
                  fullWidth
                  sx={{
                    bgcolor: '#1976d2', // Material UI blue
                    '&:hover': {
                      bgcolor: '#1565c0', // Darker blue on hover
                    }
                  }}
                >
                  Find {relatedRecipesCount} {relatedRecipesCount === 1 ? 'Recipe' : 'Recipes'} with {selectedIngredient.name}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Popover>
    </Box>
  );
};

export default RecipeDetailPage;
