import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Timer as TimerIcon,
  Restaurant as RestaurantIcon,
} from '@mui/icons-material';
import { fetchRecipeById } from '../services/api';

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
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const RecipeDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const recipeData = await fetchRecipeById(id);
        setRecipe(recipeData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError('Failed to load recipe. Please try again later.');
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !recipe) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mb: 2 }}
          variant="text"
        >
          Back
        </Button>
        <Alert severity="error" sx={{ my: 2 }}>
          {error || 'Recipe not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={handleBack}
        sx={{ mb: 2 }}
        variant="text"
      >
        Back
      </Button>

      <Card sx={{ mb: 4 }}>
        <CardMedia
          component="img"
          height="300"
          image={recipe.thumbnail}
          alt={recipe.name}
          sx={{ objectFit: 'cover' }}
        />
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {recipe.name}
          </Typography>

          <Box sx={{ mb: 2 }}>
            {recipe.category && (
              <Chip
                label={recipe.category.displayName}
                size="small"
                sx={{ mr: 1, mb: 1 }}
                color="primary"
                variant="outlined"
              />
            )}
            {recipe.cuisine && (
              <Chip
                label={recipe.cuisine.displayName}
                size="small"
                sx={{ mr: 1, mb: 1 }}
                color="secondary"
                variant="outlined"
              />
            )}
          </Box>

          <Typography variant="body1" paragraph>
            {recipe.instructions}
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
              icon={<TimerIcon />}
              iconPosition="start"
              label="Steps"
              id="recipe-tab-1"
              aria-controls="recipe-tabpanel-1"
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <List>
            {recipe.ingredients.length === 0 ? (
              <Alert severity="info">No ingredients found for this recipe.</Alert>
            ) : (
              recipe.ingredients.map((item: any, index: number) => {
                const ingredientData = item.ingredient;
                const measure = item.quantity ?
                  `${item.quantity} ${item.unit || ''}` :
                  item.originalMeasure;

                return (
                  <Box key={item.id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Typography>
                            <strong>{measure}</strong> {ingredientData.name}
                            {item.additionalInfo && ` (${item.additionalInfo})`}
                          </Typography>
                        }
                        secondary={ingredientData.description}
                      />
                    </ListItem>
                    {index < recipe.ingredients.length - 1 && <Divider />}
                  </Box>
                );
              })
            )}
          </List>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {recipe.steps.length === 0 ? (
            <Alert severity="info">No steps found for this recipe.</Alert>
          ) : (
            <Grid container spacing={3}>
              {recipe.steps
                .sort((a: any, b: any) => a.stepNumber - b.stepNumber)
                .map((step: any) => {
                  const duration = `${Math.floor(step.duration / 60)} min ${step.duration % 60} sec`;

                  return (
                    <Grid item xs={12} key={step.id}>
                      <Paper
                        elevation={1}
                        sx={{
                          p: 3,
                          display: 'flex',
                          alignItems: 'flex-start',
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
                          <Typography variant="h6">{step.stepNumber}</Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" paragraph>
                            {step.instruction}
                          </Typography>
                          <Chip
                            icon={<TimerIcon />}
                            label={duration}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
            </Grid>
          )}
        </TabPanel>
      </Box>
    </Container>
  );
};

export default RecipeDetailPage;
